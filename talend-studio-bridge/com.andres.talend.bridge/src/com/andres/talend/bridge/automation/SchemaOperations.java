package com.andres.talend.bridge.automation;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

/**
 * Schema de un nodo: las columnas y, cuando el componente las tiene, las
 * filas de datos.
 *
 * Un nodo sin schema no propaga columnas por la conexion, y el codigo
 * generado sale mal. Studio guarda el schema de cada nodo en su propio
 * `metadata` del `.item`.
 *
 * Los componentes con schema fijo (`tFixedFlowInput`) guardan ademas los
 * datos en una tabla de tipo TABLE: sin ella el job se ejecuta pero no saca
 * ninguna fila.
 */
public final class SchemaOperations {

  private SchemaOperations() {}

  /**
   * Define el schema de un nodo del job abierto.
   *
   * @param spec uniqueName, connector, columns y values.
   */
  public static Map<String, Object> set(JsonObject spec) throws Exception {
    Object editor = TalendApi.designerEditor(spec);
    Object process = TalendApi.processOf(editor);
    String uniqueName = JsonSpec.required(spec, "uniqueName");
    Object node = TalendApi.nodeByUniqueName(process, uniqueName);
    if (node == null) {
      throw new IllegalStateException("No existe el nodo '" + uniqueName + "'");
    }

    Object table = createMetadataTable(spec, uniqueName);
    // La tabla tiene que ir colgada de un conector: sin `attachedConnector`
    // Studio no la serializa y el metadata se queda vacio en el `.item`.
    table.getClass().getMethod("setAttachedConnector", String.class)
        .invoke(table, connectorName(spec));
    // Si el nodo ya tiene una tabla con ese nombre, se actualiza esa en vez
    // de crear otra: las conexiones tienen una referencia a la tabla, y si se
    // sustituye, el flujo se queda con la tabla vieja (sin las filas).
    List<Object> actuales = new ArrayList<>();
    Object listaActual = node.getClass().getMethod("getMetadataList").invoke(node);
    if (listaActual instanceof List) {
      actuales.addAll((List<?>) listaActual);
    }
    Object existente = tableNamed(actuales, uniqueName);
    if (existente == null) {
      // Studio crea en el nodo una tabla FLOW con el nombre del componente
      // recien soltado (`tDBOutput_1`) y la conexion se queda apuntando a ella.
      // Si se crea otra tabla con el nombre del nodo, el flujo sigue leyendo la
      // vieja: el `tDBOutput` con UPDATE/DELETE genera codigo contra un struct
      // vacio y falla con "nombre cannot be resolved or is not a field".
      // Por eso se reutiliza la que ya existe y se renombra.
      existente = tableOfConnector(actuales, connectorName(spec));
    }
    Object columnas = table.getClass().getMethod("getListColumns").invoke(table);
    if (existente != null) {
      existente.getClass().getMethod("setListColumns", List.class).invoke(existente, columnas);
      existente.getClass().getMethod("setTableName", String.class).invoke(existente, uniqueName);
      table = existente;
    }
    // Las tablas de otros conectores (REJECT...) se conservan; las FLOW que
    // sobren se rellenan con las mismas columnas, para que el flujo lea la que
    // lea, el schema este completo.
    List<Object> tablas = new ArrayList<>();
    tablas.add(table);
    String conector = connectorName(spec);
    for (Object otra : actuales) {
      if (otra == table) {
        continue;
      }
      Object cuelgaDe = otra.getClass().getMethod("getAttachedConnector").invoke(otra);
      String de = cuelgaDe == null ? "" : String.valueOf(cuelgaDe);
      if (de.equals(conector)) {
        otra.getClass().getMethod("setListColumns", List.class).invoke(otra, columnas);
      }
      tablas.add(otra);
    }
    node.getClass().getMethod("setMetadataList", List.class).invoke(node, tablas);
    // La conexion de entrada tiene su propia tabla de metadata, y puede ser la
    // vieja (la que Studio creo al soltar el componente, con otro nombre). Si
    // se queda vacia, el generador arma la fila de entrada sin columnas: el
    // job no compila ("nombre cannot be resolved or is not a field").
    syncIncomingConnections(node, conector, columnas);

    // Los componentes con schema fijo guardan los datos en una tabla: sin
    // ella el job se ejecuta pero no saca datos.
    fillDataTable(node, rowsOf(spec));
    useDataTable(node);

    TalendApi.markModified(process);
    JobPersistence.persist(process);

    Map<String, Object> result = new LinkedHashMap<>();
    result.put("uniqueName", uniqueName);
    result.put("columns", JsonSpec.arrayOf(spec, "columns").size());
    return result;
  }

  /**
   * La tabla del nodo que cuelga de ese conector, si la hay.
   *
   * Cuando hay varias con el mismo conector (Studio deja una vacia con el
   * nombre del componente al soltarlo), se prefiere la que ya tiene columnas.
   */
  private static Object tableOfConnector(List<Object> tables, String connector) {
    Object vacia = null;
    for (Object table : tables) {
      String de;
      try {
        Object attached = table.getClass().getMethod("getAttachedConnector").invoke(table);
        de = attached == null ? "" : String.valueOf(attached);
      } catch (Exception e) {
        continue;
      }
      if (!connector.equals(de)) {
        continue;
      }
      try {
        Object columns = table.getClass().getMethod("getListColumns").invoke(table);
        if (columns instanceof List && !((List<?>) columns).isEmpty()) {
          return table;
        }
      } catch (Exception e) {
        // Sin columnas legibles: se guarda como ultimo recurso.
      }
      if (vacia == null) {
        vacia = table;
      }
    }
    return vacia;
  }

  /**
   * Copia las columnas a la tabla de las conexiones de entrada del conector.
   *
   * Studio crea la tabla de la conexion al conectar y la deja apuntando a la
   * metadata que el nodo tenia en ese momento. Si despues se sustituye la del
   * nodo, la conexion sigue con la vieja: hay que rellenarla tambien, o el
   * codigo generado lee columnas que no existen.
   */
  private static void syncIncomingConnections(Object node, String connector, Object columnas) {
    Object conexiones;
    try {
      conexiones = node.getClass().getMethod("getIncomingConnections").invoke(node);
    } catch (Exception e) {
      return;
    }
    if (!(conexiones instanceof Iterable)) {
      return;
    }
    for (Object conexion : (Iterable<?>) conexiones) {
      Object tipo = TalendApi.invokeOrNull(conexion, "getConnectorName");
      if (tipo != null && !connector.equals(String.valueOf(tipo))) {
        continue;
      }
      Object tabla = TalendApi.invokeOrNull(conexion, "getMetadataTable");
      if (tabla == null) {
        continue;
      }
      try {
        tabla.getClass().getMethod("setListColumns", List.class).invoke(tabla, columnas);
      } catch (Exception e) {
        // La tabla es de otro tipo: se deja como esta.
      }
    }
  }

  /** La tabla del nodo que tiene ese nombre, si la hay. */
  private static Object tableNamed(List<Object> tables, String name) {
    if (name == null) {
      return null;
    }
    for (Object table : tables) {
      try {
        Object tableName = table.getClass().getMethod("getTableName").invoke(table);
        if (name.equals(String.valueOf(tableName))) {
          return table;
        }
      } catch (Exception e) {
        // Sin nombre: no es la que buscamos.
      }
    }
    return null;
  }

  /**
   * Crea la tabla de metadata con las columnas del spec.
   *
   * El `tableName` tiene que ser el unique name del nodo, como en los jobs
   * que escribe el IDE. Con otro nombre, Studio no serializa el metadata.
   */
  private static Object createMetadataTable(JsonObject spec, String uniqueName) throws Exception {
    Class<?> tableClass = TalendClasses.load("org.talend.core.model.metadata.MetadataTable");
    Object table = tableClass.getConstructor().newInstance();

    Class<?> columnClass = TalendClasses.load("org.talend.core.model.metadata.MetadataColumn");
    List<Object> columns = new ArrayList<>();
    for (JsonObject definition : JsonSpec.arrayOf(spec, "columns")) {
      String name = JsonSpec.required(definition, "name");
      Object column = columnClass.getConstructor().newInstance();
      column.getClass().getMethod("setLabel", String.class).invoke(column, name);
      column.getClass().getMethod("setId", String.class).invoke(column, name);
      // El nombre de la columna en la base de datos. Sin esto, el `tDBOutput`
      // genera el INSERT con los nombres de columna a null.
      column.getClass().getMethod("setOriginalDbColumnName", String.class).invoke(column, name);
      String type = ColumnTypes.normalize(JsonSpec.string(definition, "type"));
      column.getClass().getMethod("setType", String.class).invoke(column, type);
      column.getClass().getMethod("setTalendType", String.class).invoke(column, type);
      column.getClass().getMethod("setNullable", boolean.class).invoke(column,
          JsonSpec.booleanOf(definition, "nullable", true));
      column.getClass().getMethod("setKey", boolean.class).invoke(column,
          JsonSpec.booleanOf(definition, "key", false));
      column.getClass().getMethod("setLength", Integer.class).invoke(column,
          Integer.valueOf(integer(definition, "length", -1)));
      column.getClass().getMethod("setPrecision", Integer.class).invoke(column,
          Integer.valueOf(integer(definition, "precision", -1)));
      column.getClass().getMethod("setOriginalLength", Integer.class).invoke(column, Integer.valueOf(-1));
      column.getClass().getMethod("setPattern", String.class)
          .invoke(column, JsonSpec.stringOrEmpty(definition, "pattern"));
      column.getClass().getMethod("setComment", String.class)
          .invoke(column, JsonSpec.stringOrEmpty(definition, "comment"));
      column.getClass().getMethod("setSourceType", String.class)
          .invoke(column, JsonSpec.stringOrEmpty(definition, "sourceType"));
      column.getClass().getMethod("setUsefulColumn", boolean.class).invoke(column, Boolean.TRUE);
      columns.add(column);
    }

    table.getClass().getMethod("setListColumns", List.class).invoke(table, columns);
    table.getClass().getMethod("setTableName", String.class).invoke(table, uniqueName);
    return table;
  }

  /**
   * Filas de datos que se guardan en la tabla del componente.
   *
   * Se leen del parametro `values` del spec: una lista de filas, cada fila con
   * un valor por columna. Si no hay `values`, se crea una fila vacia.
   */
  private static List<List<String>> rowsOf(JsonObject spec) {
    List<List<String>> rows = new ArrayList<>();
    JsonElement raw = spec.get("values");
    if (raw == null || !raw.isJsonArray()) {
      return rows;
    }
    for (JsonElement row : raw.getAsJsonArray()) {
      List<String> values = new ArrayList<>();
      if (row.isJsonArray()) {
        for (JsonElement value : row.getAsJsonArray()) {
          values.add(value.isJsonNull() ? "" : value.getAsString());
        }
      } else if (row.isJsonPrimitive()) {
        values.add(row.getAsString());
      }
      rows.add(values);
    }
    return rows;
  }

  /**
   * Rellena la tabla de datos del componente, si la tiene.
   *
   * Los componentes con schema fijo guardan los datos en dos tablas: la de
   * codigos `SCHEMA_COLUMN`/`VALUE` (las columnas y su valor por defecto) y
   * la que tiene `columnsBasedOnSchema` (los registros).
   */
  private static void fillDataTable(Object node, List<List<String>> rows) throws Exception {
    List<Column> columns = columnsOf(node);
    if (columns.isEmpty()) {
      return;
    }
    for (Object parameter : (List<?>) node.getClass().getMethod("getElementParameters").invoke(node)) {
      Object fieldType = parameter.getClass().getMethod("getFieldType").invoke(parameter);
      if (fieldType == null || !"TABLE".equals(String.valueOf(fieldType))) {
        continue;
      }
      Object codes = parameter.getClass().getMethod("getListItemsDisplayCodeName").invoke(parameter);
      List<String> columnCodes = new ArrayList<>();
      if (codes instanceof Object[]) {
        for (Object code : (Object[]) codes) {
          columnCodes.add(String.valueOf(code));
        }
      }
      if (columnCodes.contains("SCHEMA_COLUMN")) {
        // Tabla de definicion de columnas: una entrada por columna.
        List<Object> definition = new ArrayList<>();
        for (int i = 0; i < columns.size(); i++) {
          Map<String, Object> row = new LinkedHashMap<>();
          row.put("SCHEMA_COLUMN", columns.get(i).name);
          if (columnCodes.contains("VALUE")) {
            row.put("VALUE", rows.isEmpty() || i >= rows.get(0).size()
                ? "" : ComponentConfigurator.javaLiteral(rows.get(0).get(i), columns.get(i).type));
          }
          definition.add(row);
        }
        parameter.getClass().getMethod("setValue", Object.class).invoke(parameter, definition);
        continue;
      }
      if (Boolean.TRUE.equals(parameter.getClass().getMethod("isColumnsBasedOnSchema").invoke(parameter))) {
        // Tabla de datos: una fila por registro, con una clave por columna.
        // Los nombres de columna se ponen siempre: si el componente se queda
        // con las columnas de otro (al conectar, el destino propaga su
        // esquema hacia atras), la tabla se queda con los nombres viejos y
        // las filas salen vacias.
        String[] names = new String[columns.size()];
        for (int i = 0; i < columns.size(); i++) {
          names[i] = columns.get(i).name;
        }
        try {
          parameter.getClass().getMethod("setListItemsDisplayCodeName", String[].class)
              .invoke(parameter, (Object) names);
        } catch (Exception e) {
          return;
        }
        List<Object> data = new ArrayList<>();
        for (List<String> values : rows) {
          Map<String, Object> row = new LinkedHashMap<>();
          for (int i = 0; i < columns.size(); i++) {
            String value = i < values.size() ? values.get(i) : "";
            row.put(columns.get(i).name, ComponentConfigurator.javaLiteral(value, columns.get(i).type));
          }
          data.add(row);
        }
        parameter.getClass().getMethod("setValue", Object.class).invoke(parameter, data);
      }
    }
  }

  /**
   * Pone el componente en modo "tabla de datos".
   *
   * Los componentes con schema fijo (tFixedFlowInput) tienen tres modos:
   * single (un valor), intable (las filas de una tabla) e inline (un texto).
   * Por defecto nacen en single, asi que los datos de la tabla se ignoran.
   */
  private static void useDataTable(Object node) {
    setParameterValue(node, "USE_SINGLEMODE", "false");
    setParameterValue(node, "USE_INTABLE", "true");
  }

  /** Cambia el valor de un parametro del nodo, si existe. */
  private static void setParameterValue(Object node, String name, String value) {
    try {
      Object parameter = node.getClass().getMethod("getElementParameter", String.class)
          .invoke(node, name);
      if (parameter == null) {
        return;
      }
      parameter.getClass().getMethod("setValue", Object.class).invoke(parameter, value);
    } catch (Exception e) {
      // El parametro no existe en este componente: no pasa nada.
    }
  }

  /** Columnas del schema que tiene el nodo. */
  private static List<Column> columnsOf(Object node) throws Exception {
    List<Column> columns = new ArrayList<>();
    Object metadataList = node.getClass().getMethod("getMetadataList").invoke(node);
    if (!(metadataList instanceof Iterable)) {
      return columns;
    }
    // Solo la primera tabla: es la del schema del componente. Las demas
    // (REJECT...) tienen sus propias columnas y no van en la tabla de datos.
    for (Object table : (Iterable<?>) metadataList) {
      Object listColumns = table.getClass().getMethod("getListColumns").invoke(table);
      if (!(listColumns instanceof Iterable)) {
        continue;
      }
      for (Object column : (Iterable<?>) listColumns) {
        columns.add(new Column(
            String.valueOf(column.getClass().getMethod("getLabel").invoke(column)),
            ColumnTypes.of(column)));
      }
      break;
    }
    return columns;
  }

  /** Columna del schema: nombre y tipo Java. */
  private static final class Column {
    private final String name;
    private final String type;

    Column(String name, String type) {
      this.name = name;
      this.type = type;
    }
  }

  /** Conector al que cuelga la tabla de metadata. */
  private static String connectorName(JsonObject spec) {
    String connector = JsonSpec.string(spec, "connector");
    return connector != null && !connector.trim().isEmpty() ? connector : "FLOW";
  }

  /** Entero del spec, con valor por defecto. */
  private static int integer(JsonObject object, String key, int fallback) {
    if (object == null || !object.has(key) || object.get(key).isJsonNull()) {
      return fallback;
    }
    try {
      return object.get(key).getAsInt();
    } catch (RuntimeException e) {
      return fallback;
    }
  }
}
