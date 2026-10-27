package com.andres.talend.bridge.automation;

import java.util.ArrayList;
import java.util.List;

import com.andres.talend.bridge.BridgeLog;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

/** Aplica y actualiza el metadata de schema de un nodo. */
final class ComponentSchemaConfigurator {
  private ComponentSchemaConfigurator() {}

  static void apply(Object node, JsonObject spec) throws Exception {
    JsonElement raw = spec.get("schema");
    if (raw == null || !raw.isJsonArray()) {
      return;
    }
    List<Object> actuales = new ArrayList<>();
    Object listaActual = node.getClass().getMethod("getMetadataList").invoke(node);
    if (listaActual instanceof List) {
      actuales.addAll((List<?>) listaActual);
    }

    List<Object> tables = new ArrayList<>();
    for (JsonElement entry : raw.getAsJsonArray()) {
      if (!entry.isJsonObject()) {
        continue;
      }
      JsonObject definition = entry.getAsJsonObject();
      String connector = JsonSpec.string(definition, "connector");
      String name = JsonSpec.string(definition, "name");
      JsonElement columns = definition.get("columns");
      if (columns == null || !columns.isJsonArray()) {
        continue;
      }
      // Si el nodo ya tiene una tabla con ese nombre, se actualiza esa: la
      // sustitucion rompe las referencias que tienen las conexiones (el
      // tAggregateRow se queda sin las columnas de entrada: "inputColumn is
      // null").
      Object existente = tableNamed(actuales, name, connector);
      if (existente != null) {
        MetadataSchemaFactory.setColumnsOf(existente, columns.getAsJsonArray());
        tables.add(existente);
      } else {
        tables.add(MetadataSchemaFactory.createMetadataTable(connector, name, columns.getAsJsonArray()));
      }
    }
    if (tables.isEmpty()) {
      return;
    }
    // Las tablas que ya tenia el nodo y no pide el spec se conservan: puede
    // que una conexion las tenga asignadas.
    for (Object actual : actuales) {
      if (!tables.contains(actual)) {
        if (isStaleFilterRowFlowSchema(node, actual)) {
          continue;
        }
        tables.add(actual);
      }
    }
    node.getClass().getMethod("setMetadataList", List.class).invoke(node, tables);
    // La tabla de rechazo se deja como estaba: al conectar, Talend propaga el
    // esquema del destino hacia atras y mete sus columnas en la del origen.
    restoreRejectTables(actuales, tables);
  }

  /** Elimina restos FLOW de tFilterRow: sus salidas usan FILTER y REJECT. */
  private static boolean isStaleFilterRowFlowSchema(Object node, Object table) {
    if (!"tFilterRow".equals(componentNameOf(node)) || !"FLOW".equals(conectorDe(table))) {
      return false;
    }
    try {
      Object rawName = table.getClass().getMethod("getTableName").invoke(table);
      String name = rawName == null ? "" : String.valueOf(rawName);
      if (name.endsWith("_schema")) {
        return true;
      }
      Object columns = table.getClass().getMethod("getListColumns").invoke(table);
      return columns instanceof List && ((List<?>) columns).isEmpty();
    } catch (Exception e) {
      return false;
    }
  }

  private static String componentNameOf(Object node) {
    try {
      Object parameter = node.getClass().getMethod("getElementParameter", String.class)
          .invoke(node, "COMPONENT_NAME");
      Object value = parameter == null ? null : parameter.getClass().getMethod("getValue").invoke(parameter);
      return value == null ? "" : String.valueOf(value);
    } catch (Exception e) {
      return "";
    }
  }

  /**
   * Devuelve las tablas de rechazo del nodo a sus columnas de error, cuando
   * se han quedado con columnas de otro componente.
   *
   * Cuando se conectan dos componentes, Talend sincroniza el origen con el
   * destino: si el destino ya tiene un esquema (por ejemplo, el `tAggregateRow`
   * con sus columnas de salida), el origen se queda con esas columnas, y su
   * tabla de rechazo tambien. Con el origen descolocado, el generador del
   * `tFileInputDelimited` falla con "Index N out of bounds for length N".
   *
   * Una tabla de rechazo sanita tiene las columnas del propio nodo mas
   * `errorCode` y `errorMessage`. Si trae columnas que no son del nodo, esta
   * contaminada: se deja con las dos columnas de error, que es lo que
   * funciona.
   */
  private static void restoreRejectTables(List<Object> actuales, List<Object> aplicadas)
      throws Exception {
    java.util.Set<String> propias = new java.util.HashSet<>();
    propias.add("errorCode");
    propias.add("errorMessage");
    // Las columnas del propio nodo son las de sus tablas de datos.
    for (Object table : actuales) {
      if (!esDeRechazo(table)) {
        propias.addAll(etiquetasDe(table));
      }
    }
    for (Object table : actuales) {
      if (aplicadas.contains(table) || !esDeRechazo(table)) {
        continue;
      }
      boolean contaminada = false;
      for (String etiqueta : etiquetasDe(table)) {
        if (!propias.contains(etiqueta)) {
          contaminada = true;
          break;
        }
      }
      if (contaminada) {
        BridgeLog.info("Tabla de rechazo contaminada: se deja con las columnas de error");
        MetadataSchemaFactory.setColumnsOf(table, columnasDeError());
      }
    }
  }

  /** Si la tabla esta enganchada a un conector de rechazo. */
  private static boolean esDeRechazo(Object table) {
    String conector = conectorDe(table);
    return conector != null && conector.toUpperCase().startsWith("REJECT");
  }

  /** Las etiquetas (nombres) de las columnas de una tabla de metadata. */
  private static List<String> etiquetasDe(Object table) {
    List<String> etiquetas = new ArrayList<>();
    try {
      Object columnas = table.getClass().getMethod("getListColumns").invoke(table);
      if (!(columnas instanceof List)) {
        return etiquetas;
      }
      for (Object columna : (List<?>) columnas) {
        Object etiqueta = columna.getClass().getMethod("getLabel").invoke(columna);
        if (etiqueta != null) {
          etiquetas.add(String.valueOf(etiqueta));
        }
      }
    } catch (Exception e) {
      // Sin columnas: se deja la tabla como estaba.
    }
    return etiquetas;
  }

  /** Las dos columnas de error de una tabla de rechazo. */
  private static JsonArray columnasDeError() {
    JsonArray columnas = new JsonArray();
    JsonObject errorCode = new JsonObject();
    errorCode.addProperty("name", "errorCode");
    errorCode.addProperty("type", "id_Integer");
    columnas.add(errorCode);
    JsonObject errorMessage = new JsonObject();
    errorMessage.addProperty("name", "errorMessage");
    errorMessage.addProperty("type", "id_String");
    columnas.add(errorMessage);
    return columnas;
  }

  /** El conector al que esta enganchada una tabla de metadata. */
  private static String conectorDe(Object table) {
    try {
      Object conector = table.getClass().getMethod("getAttachedConnector").invoke(table);
      return conector == null ? null : String.valueOf(conector);
    } catch (Exception e) {
      return null;
    }
  }

  /** La tabla del nodo que tiene ese nombre, si la hay. */
  private static Object tableNamed(List<Object> tables, String name, String connector) {
    if (name == null || connector == null) {
      return null;
    }
    for (Object table : tables) {
      try {
        Object tableName = table.getClass().getMethod("getTableName").invoke(table);
        if (name.equals(String.valueOf(tableName)) && connector.equals(conectorDe(table))) {
          return table;
        }
      } catch (Exception e) {
        // Sin nombre: no es la que buscamos.
      }
    }
    return null;
  }

  /** Cambia las columnas de una tabla que ya existe. */
  // ---------------------------------------------------------------------
}
