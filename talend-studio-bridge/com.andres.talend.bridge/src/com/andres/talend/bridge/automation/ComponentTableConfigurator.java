package com.andres.talend.bridge.automation;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import com.andres.talend.bridge.BridgeLog;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

/** Aplica los valores tabulares declarados para un nodo. */
final class ComponentTableConfigurator {
  private ComponentTableConfigurator() {}

  static void apply(Object node, JsonObject spec) throws Exception {
    JsonObject tables = JsonSpec.objectOf(spec, "tables");
    for (Map.Entry<String, JsonElement> entry : tables.entrySet()) {
      JsonElement raw = entry.getValue();
      if (raw == null || !raw.isJsonObject()) {
        continue;
      }
      JsonObject definition = raw.getAsJsonObject();
      List<String> columnCodes = columnCodesOf(node, entry.getKey(), definition);

      List<Object> rows = new ArrayList<>();
      JsonElement rawRows = definition.get("rows");
      if (rawRows != null && rawRows.isJsonArray()) {
        for (JsonElement row : rawRows.getAsJsonArray()) {
           rows.add(toRow(row, columnCodes, entry.getKey()));
        }
      }
      Object parameter = node.getClass().getMethod("getElementParameter", String.class)
          .invoke(node, entry.getKey());
      if (parameter == null) {
        BridgeLog.warn("El componente no tiene la tabla '" + entry.getKey() + "'");
        continue;
      }
      parameter.getClass().getMethod("setValue", Object.class).invoke(parameter, rows);
    }
  }

  /**
   * Codigos de columna de una tabla.
   *
   * Si la tabla no los tieneTodavia, se ponen los que declara el spec. Una
   * tabla con `columnsBasedOnSchema` (la `INTABLE` del tFixedFlowInput) los
   * deduce del schema del nodo.
   */
  private static List<String> columnCodesOf(Object node, String tableName, JsonObject definition)
      throws Exception {
    Object parameter = node.getClass().getMethod("getElementParameter", String.class)
        .invoke(node, tableName);
    if (parameter == null) {
      return new ArrayList<>();
    }
    List<String> codes = new ArrayList<>();
    Object raw = parameter.getClass().getMethod("getListItemsDisplayCodeName").invoke(parameter);
    if (raw instanceof Object[]) {
      for (Object code : (Object[]) raw) {
        codes.add(String.valueOf(code));
      }
    }
    if (!codes.isEmpty()) {
      return codes;
    }

    List<String> declared = new ArrayList<>();
    JsonElement columns = definition.get("columns");
    if (columns != null && columns.isJsonArray()) {
      for (JsonElement column : columns.getAsJsonArray()) {
        declared.add(column.isJsonPrimitive() ? column.getAsString() : column.toString());
      }
    }
    if (declared.isEmpty()) {
      return codes;
    }
    try {
      parameter.getClass().getMethod("setListItemsDisplayCodeName", String[].class)
          .invoke(parameter, (Object) declared.toArray(new String[0]));
    } catch (Exception e) {
      BridgeLog.warn("No se pudieron fijar los codigos de la tabla '" + tableName + "'", e);
    }
    return declared;
  }

  /** Convierte una fila del spec en el mapa que espera la tabla. */
  private static Object toRow(JsonElement row, List<String> columnCodes, String tableName) {
    Map<String, Object> values = new LinkedHashMap<>();
    if (row.isJsonObject()) {
      for (Map.Entry<String, JsonElement> entry : row.getAsJsonObject().entrySet()) {
          values.put(entry.getKey(), valorDeCelda(tableName, entry.getKey(), entry.getValue()));
      }
      return values;
    }
    if (row.isJsonArray()) {
      JsonArray array = row.getAsJsonArray();
      for (int i = 0; i < array.size(); i++) {
        String code = i < columnCodes.size() ? columnCodes.get(i) : "column" + i;
        JsonElement value = array.get(i);
        values.put(code, valorDeCelda(tableName, code, value));
      }
    }
    return values;
  }

  /**
   * El valor de una celda de tabla, como literal Java.
   *
   * Los valores de las tablas van al codigo generado como literales, asi que
   * el IDE los entrecomilla: la consulta de un `tFileInputJSON` sale como
   * `"$.clientes[*].id"`. Los que son nombres (de columna, de funcion, de
   * orden...) van sin comillas, y los booleanos y los numeros tampoco.
   */
  private static Object valorDeCelda(String tableName, String code, JsonElement raw) {
    if (raw == null || raw.isJsonNull()) {
      return "";
    }
    String value = raw.getAsString();
    // El JavaJet de tDataMasking agrega las comillas a estos enums. Guardarlos
    // como literales Java aqui produciria `""SET_TO_NULL""` en el codigo generado.
    if ("MODIF_TABLE".equals(tableName)
        && ("CATEGORY".equals(code) || "FUNCTION".equals(code)
            || "METHOD".equals(code) || "ALPHABET".equals(code))) {
      return value;
    }
    // El JavaJet de los formatos posicionales inserta estos valores como
    // expresiones Java (por ejemplo, ' ' y 'L'), no como cadenas entrecomilladas.
    if ("FORMATS".equals(tableName)
        && ("PADDING_CHAR".equals(code) || "ALIGN".equals(code) || "KEEP".equals(code))) {
      return value;
    }
    // tDataShuffling inserta estos nombres dentro de sus propios literales Java.
    if (("SHUFFLING_COLUMNS".equals(tableName) && "COLUMN".equals(code))
        || ("PARTITIONING_COLUMNS".equals(tableName) && "PARTITIONING_COLUMN".equals(code))) {
      return value;
    }
    // tSynonymSearch usa estos valores como identificadores Java y enum Lucene.
    if ("SEARCH_INDEXS".equals(tableName)
        && ("PRE_COLUMN".equals(code) || "COLUMN".equals(code) || "SEARCH_MODE".equals(code))) {
      return value;
    }
    if (esNombreDeCelda(code)) {
      return value;
    }
    return ComponentConfigurator.asLiteral(value, null);
  }

  /**
   * Si el codigo de una celda es un nombre y no un literal.
   *
   * Son las columnas que el componente declara como lista de columnas
   * (`PREV_COLUMN_LIST`, `COLUMN_LIST`) o como lista cerrada: el nombre de
   * la columna, la funcion, el operador, el orden... El IDE las escribe sin
   * comillas.
   */
  private static boolean esNombreDeCelda(String code) {
    if (code == null) {
      return false;
    }
    switch (code) {
      case "SCHEMA_COLUMN":
      case "COLNAME":
      case "INPUT_COLUMN":
      case "LOOKUP_COLUMN":
      case "OUTPUT_COLUMN":
      case "FUNCTION":
      case "OPERATOR":
      case "SORT":
      case "ORDER":
      case "KEY_ATTRIBUTE":
      case "CASE_SENSITIVE":
      case "PARAMETER_NAME":
      case "TARGET_COLUMN":
        return true;
      default:
        return false;
    }
  }

  // ---------------------------------------------------------------------
}

