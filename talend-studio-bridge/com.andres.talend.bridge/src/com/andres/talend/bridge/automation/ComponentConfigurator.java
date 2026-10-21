package com.andres.talend.bridge.automation;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import com.andres.talend.bridge.BridgeLog;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

/**
 * Configuracion declarativa de un componente de Talend.
 *
 * El nucleo del MCP no debe conocer componentes concretos: la configuracion se
 * declara y se aplica con la misma API para todos. Hay cuatro cosas que se
 * pueden configurar, y las cuatro son genericas:
 *
 * - `parameters`: los parametros del componente (`FILE_PATH`, `ENCODING`...).
 * - `tables`: los parametros de tipo TABLE, con sus columnas y sus filas.
 * - `schema`: el metadata del nodo, por conector y por nombre de tabla.
 * - `mapper`: el modelo del tMap (transformaciones, filtros y joins).
 *
 * Lo que sea especifico de un componente (hoy solo el `mapper`) vive en un
 * adaptador aparte: anadir soporte para un componente nuevo es anadir un
 * adaptador, sin tocar el nucleo.
 *
 * Formato del spec:
 *
 * ```json
 * {
 *   "parameters": { "FILE_PATH": { "value": "C:/datos/clientes.csv" },
 *                   "ENCODING": { "value": "UTF-8" } },
 *   "tables": { "INTABLE": { "columns": ["id", "ciudad"],
 *                            "rows": [["1", "Bogota"]] } },
 *   "schema": [ { "connector": "FLOW", "name": "tLogRow_1",
 *                 "columns": [ { "name": "id", "type": "id_Integer" } ] } ],
 *   "mapper": { "inputs": [], "outputs": [], "vars": [] }
 * }
 * ```
 */
public final class ComponentConfigurator {

  private ComponentConfigurator() {}

  /**
   * Aplica toda la configuracion de un nodo.
   *
   * @param node nodo recien creado, todavia sin anadir al proceso.
   * @param spec configuracion declarada.
   */
  public static void configure(Object node, JsonObject spec) throws Exception {
    applyParameters(node, spec);
    applyTables(node, spec);
    applySchema(node, spec);
    applyNodeData(node, spec);
  }

  // ---------------------------------------------------------------------
  // Parametros
  // ---------------------------------------------------------------------

  /**
   * Aplica los parametros del componente.
   *
   * El valor puede venir como texto plano o como objeto con `value` y, si
   * hace falta, `literal` (si es true, el valor se pone entre comillas).
   *
   * Los valores de texto de Talend son literales Java: el generador los
   * escribe tal cual en el codigo, asi que una ruta tiene que ir entre
   * comillas (`"C:/datos/clientes.csv"`) o el codigo no compila. Los
   * booleanos y los numeros van sin comillas.
   */
  public static void applyParameters(Object node, JsonObject spec) throws Exception {
    JsonObject parameters = JsonSpec.objectOf(spec, "parameters");
    for (Map.Entry<String, JsonElement> entry : parameters.entrySet()) {
      JsonElement raw = entry.getValue();
      if (raw == null || raw.isJsonNull()) {
        continue;
      }
      JsonObject definition = new JsonObject();
      String value;
      Boolean literal = null;
      if (raw.isJsonObject()) {
        definition = raw.getAsJsonObject();
        JsonElement element = definition.get("value");
        if (element == null || element.isJsonNull()) {
          continue;
        }
        value = element.isJsonPrimitive() ? element.getAsString() : element.toString();
        if (definition.has("literal") && !definition.get("literal").isJsonNull()) {
          literal = definition.get("literal").getAsBoolean();
        }
      } else if (raw.isJsonPrimitive()) {
        value = raw.getAsString();
        definition.addProperty("value", value);
      } else {
        continue;
      }

      Object parameter = node.getClass().getMethod("getElementParameter", String.class)
          .invoke(node, entry.getKey());
      if (parameter == null) {
        // Hay componentes cuyo parametro no aparece en el catalogo hasta que
        // se configura (el `FILENAME` del tFileOutputDelimited, por ejemplo).
        // Se crea con el tipo indicado, que es lo que hace el IDE al migrar
        // un job antiguo.
        parameter = createParameter(node, entry.getKey(), definition);
        if (parameter == null) {
          BridgeLog.warn("El componente no tiene el parametro '" + entry.getKey() + "'");
          continue;
        }
      }
      parameter.getClass().getMethod("setValue", Object.class)
          .invoke(parameter, valueOf(parameter, value, literal));
      completeProcessReference(node, parameter, value);
    }
  }

  /**
   * Completa la referencia a otro job.
   *
   * Los componentes que lanzan otro job (el tRunJob, el tRunRoutine) guardan
   * la referencia en varios parametros: el `PROCESS` con la etiqueta, y tres
   * parametros tecnicos con el contexto, el id interno del item y la version.
   * Si solo se pone la etiqueta, el job hijo no se encuentra.
   *
   * @param parameter el parametro que se acaba de poner.
   * @param value la etiqueta del job hijo.
   */
  private static void completeProcessReference(Object node, Object parameter, String value) {
    try {
      Object fieldType = parameter.getClass().getMethod("getFieldType").invoke(parameter);
      if (!"PROCESS_TYPE".equals(String.valueOf(fieldType))) {
        return;
      }
      String jobName = value == null ? null : value.replace("\"", "").trim();
      if (jobName == null || jobName.isEmpty()) {
        return;
      }
      String id = TalendApi.internalIdOf(jobName);
      if (id == null) {
        BridgeLog.warn("No se encontro el job '" + jobName + "' en el repositorio");
        return;
      }
      String label = TalendApi.projectLabel();
      setTechnical(node, "PROCESS:PROCESS_TYPE_CONTEXT", "Default");
      setTechnical(node, "PROCESS:PROCESS_TYPE_PROCESS",
          (label == null ? "" : label) + ":" + id);
      setTechnical(node, "PROCESS:PROCESS_TYPE_VERSION", "Latest");
    } catch (Exception e) {
      BridgeLog.warn("No se pudo completar la referencia al job", e);
    }
  }

  /** Pone el valor de un parametro tecnico, creandolo si hace falta. */
  private static void setTechnical(Object node, String name, String value) throws Exception {
    Object parameter = node.getClass().getMethod("getElementParameter", String.class)
        .invoke(node, name);
    if (parameter == null) {
      parameter = createParameter(node, name, technical(name));
    }
    if (parameter != null) {
      parameter.getClass().getMethod("setValue", Object.class).invoke(parameter, value);
    }
  }

  /** Spec de un parametro tecnico, con su tipo de campo. */
  private static JsonObject technical(String name) {
    JsonObject definition = new JsonObject();
    definition.addProperty("field", "TECHNICAL");
    definition.addProperty("value", "");
    return definition;
  }

  /**
   * Valor final de un parametro.
   *
   * Los memos (el codigo Java del tJavaRow, el script del tJava) no son
   * literales: se escriben tal cual en el codigo generado, asi que no se
   * entrecomillan. El resto sigue la regla de los literales Java.
   */
  private static String valueOf(Object parameter, String value, Boolean literal) throws Exception {
    Object fieldType = parameter.getClass().getMethod("getFieldType").invoke(parameter);
    String kind = fieldType == null ? "" : String.valueOf(fieldType);
    if (kind.startsWith("MEMO") || kind.startsWith("PROPERTY") || kind.startsWith("EXPRESSION")) {
      return value;
    }
    return asLiteral(value, literal);
  }

  /**
   * Crea un parametro que el componente no declara.
   *
   * @param field tipo de campo pedido (FILE, TEXT, CHECK...). Si no se indica,
   *        se deduce del valor: una ruta es un FILE.
   */
  private static Object createParameter(Object node, String name, JsonObject definition) {
    try {
      Class<?> parameterClass = TalendClasses.load("org.talend.designer.core.model.components.ElementParameter");
      Class<?> elementClass = TalendClasses.load("org.talend.core.model.process.IElement");
      Object parameter = parameterClass.getConstructor(elementClass).newInstance(node);
      parameter.getClass().getMethod("setName", String.class).invoke(parameter, name);
      parameter.getClass().getMethod("setDisplayName", String.class).invoke(parameter, name);

      Object fieldType = fieldTypeOf(JsonSpec.string(definition, "field"), definition);
      if (fieldType != null) {
        parameter.getClass().getMethod("setFieldType", fieldType.getClass()).invoke(parameter, fieldType);
      }
      parameter.getClass().getMethod("setElement", elementClass).invoke(parameter, node);

      // La lista de parametros del nodo: se sustituye entera para que el
      // nodo se entere del parametro nuevo.
      @SuppressWarnings("unchecked")
      List<Object> parameters = (List<Object>) node.getClass()
          .getMethod("getElementParameters").invoke(node);
      parameters.add(parameter);
      node.getClass().getMethod("setElementParameters", List.class).invoke(node, parameters);
      return parameter;
    } catch (Exception e) {
      BridgeLog.warn("No se pudo crear el parametro '" + name + "'", e);
      return null;
    }
  }

  /** Tipo de campo de un parametro, deducido del spec. */
  private static Object fieldTypeOf(String field, JsonObject definition) {
    String name = field;
    if (name == null || name.trim().isEmpty()) {
      // Sin tipo indicado, una ruta es un fichero y el resto texto.
      String value = JsonSpec.string(definition, "value");
      name = value != null && (value.contains("/") || value.contains("\\")) ? "FILE" : "TEXT";
    }
    try {
      Class<?> typeClass = TalendClasses.load("org.talend.core.model.process.EParameterFieldType");
      for (java.lang.reflect.Field field2 : typeClass.getFields()) {
        if (name.equalsIgnoreCase(field2.getName())) {
          return field2.get(null);
        }
      }
    } catch (Exception e) {
      return null;
    }
    return null;
  }

  /**
   * Convierte un valor en el literal Java que espera el generador.
   *
   * - Si ya viene entrecomillado, se deja.
   * - Si es un booleano, un numero o esta vacio, se deja: en Talend esos
   *   valores no son cadenas.
   * - En cualquier otro caso, se entrecomilla.
   */
  public static String asLiteral(String value, Boolean forceLiteral) {
    if (value == null) {
      return null;
    }
    if (forceLiteral != null) {
      return forceLiteral ? quote(value) : value;
    }
    String trimmed = value.trim();
    if (trimmed.isEmpty()) {
      return value;
    }
    if (trimmed.length() >= 2 && trimmed.startsWith("\"") && trimmed.endsWith("\"")) {
      return value;
    }
    if ("true".equalsIgnoreCase(trimmed) || "false".equalsIgnoreCase(trimmed)) {
      return value;
    }
    if (trimmed.matches("-?\\d+(\\.\\d+)?")) {
      return value;
    }
    return quote(value);
  }

  /** Entrecomilla un valor, escapando lo que haya que escapar. */
  public static String quote(String value) {
    return "\"" + value.replace("\\", "\\\\").replace("\"", "\\\"") + "\"";
  }

  // ---------------------------------------------------------------------
  // Tablas
  // ---------------------------------------------------------------------

  /**
   * Rellena los parametros de tipo TABLE.
   *
   * El formato en memoria de una tabla es una lista de mapas: cada mapa es
   * una fila y sus claves son los codigos de columna de la tabla. Talend lo
   * serializa como `elementValue` dentro del `elementParameter` de tipo TABLE.
   *
   * Las filas se pueden dar como arrays (se emparejan con los codigos de la
   * tabla, en orden) o como objetos (se usan tal cual).
   */
  public static void applyTables(Object node, JsonObject spec) throws Exception {
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
          rows.add(toRow(row, columnCodes));
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
  private static Object toRow(JsonElement row, List<String> columnCodes) {
    Map<String, Object> values = new LinkedHashMap<>();
    if (row.isJsonObject()) {
      for (Map.Entry<String, JsonElement> entry : row.getAsJsonObject().entrySet()) {
        values.put(entry.getKey(), entry.getValue().isJsonNull() ? "" : entry.getValue().getAsString());
      }
      return values;
    }
    if (row.isJsonArray()) {
      JsonArray array = row.getAsJsonArray();
      for (int i = 0; i < array.size(); i++) {
        String code = i < columnCodes.size() ? columnCodes.get(i) : "column" + i;
        JsonElement value = array.get(i);
        values.put(code, value.isJsonNull() ? "" : value.getAsString());
      }
    }
    return values;
  }

  // ---------------------------------------------------------------------
  // Schema
  // ---------------------------------------------------------------------

  /**
   * Pone el metadata del nodo.
   *
   * El metadata va por conector y por nombre de tabla: un `tFileInputDelimited`
   * tiene una tabla en FLOW y otra en REJECT, y cada una con sus columnas.
   */
  public static void applySchema(Object node, JsonObject spec) throws Exception {
    JsonElement raw = spec.get("schema");
    if (raw == null || !raw.isJsonArray()) {
      return;
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
      tables.add(createMetadataTable(connector, name, columns.getAsJsonArray()));
    }
    if (tables.isEmpty()) {
      return;
    }
    node.getClass().getMethod("setMetadataList", List.class).invoke(node, tables);
  }

  /**
   * Crea la tabla de metadata con sus columnas.
   *
   * El `tableName` tiene que ser el unique name del nodo, como en los jobs
   * que escribe el IDE. Con otro nombre, Studio no serializa el metadata.
   */
  private static Object createMetadataTable(String connector, String name, JsonArray columns)
      throws Exception {
    Class<?> tableClass = talendClass("org.talend.core.model.metadata.MetadataTable");
    Object table = tableClass.getConstructor().newInstance();

    Class<?> columnClass = talendClass("org.talend.core.model.metadata.MetadataColumn");
    List<Object> columnas = new ArrayList<>();
    for (JsonElement raw : columns) {
      if (!raw.isJsonObject()) {
        continue;
      }
      JsonObject definition = raw.getAsJsonObject();
      String columnName = JsonSpec.string(definition, "name");
      if (columnName == null) {
        continue;
      }
      Object column = columnClass.getConstructor().newInstance();
      column.getClass().getMethod("setLabel", String.class).invoke(column, columnName);
      column.getClass().getMethod("setId", String.class).invoke(column, columnName);
      String type = ColumnTypes.normalize(JsonSpec.string(definition, "type"));
      column.getClass().getMethod("setType", String.class).invoke(column, type);
      column.getClass().getMethod("setTalendType", String.class).invoke(column, type);
      column.getClass().getMethod("setNullable", boolean.class).invoke(column,
          definition.has("nullable") ? definition.get("nullable").getAsBoolean() : true);
      column.getClass().getMethod("setKey", boolean.class).invoke(column,
          definition.has("key") ? definition.get("key").getAsBoolean() : false);
      column.getClass().getMethod("setLength", Integer.class).invoke(column,
          definition.has("length") ? Integer.valueOf(definition.get("length").getAsInt()) : Integer.valueOf(-1));
      column.getClass().getMethod("setPrecision", Integer.class).invoke(column,
          definition.has("precision") ? Integer.valueOf(definition.get("precision").getAsInt()) : Integer.valueOf(-1));
      column.getClass().getMethod("setOriginalLength", Integer.class).invoke(column, Integer.valueOf(-1));
      column.getClass().getMethod("setPattern", String.class).invoke(column, JsonSpec.stringOrEmpty(definition, "pattern"));
      column.getClass().getMethod("setComment", String.class).invoke(column, JsonSpec.stringOrEmpty(definition, "comment"));
      column.getClass().getMethod("setSourceType", String.class).invoke(column, JsonSpec.stringOrEmpty(definition, "sourceType"));
      column.getClass().getMethod("setUsefulColumn", boolean.class).invoke(column, Boolean.TRUE);
      columnas.add(column);
    }
    table.getClass().getMethod("setListColumns", List.class).invoke(table, columnas);
    table.getClass().getMethod("setTableName", String.class).invoke(table, name == null ? "" : name);
    table.getClass().getMethod("setAttachedConnector", String.class)
        .invoke(table, connector == null ? "FLOW" : connector);
    return table;
  }

  // ---------------------------------------------------------------------
  // Modelo del componente
  // ---------------------------------------------------------------------

  /**
   * Aplica el modelo especifico del componente, si lo tiene.
   *
   * Hoy solo el tMap: sus transformaciones, sus filtros y sus joins viven en
   * un modelo propio (el `nodeData` del `.item`).
   */
  public static void applyNodeData(Object node, JsonObject spec) throws Exception {
    JsonElement mapper = spec.get("mapper");
    if (mapper != null && mapper.isJsonObject()) {
      MapperConfigurer.configure(node, mapper.getAsJsonObject());
    }
  }

  // ---------------------------------------------------------------------
  // Utilidades
  // ---------------------------------------------------------------------

  /**
   * Convierte un valor en el literal Java que espera el codigo generado.
   *
   * Las cadenas van entre comillas: el generador escribe el valor tal cual en
   * el codigo, asi que un texto sin comillas no compila. Y los numeros llevan
   * el sufijo de su tipo, porque `100` es un int y no un Double.
   */
  public static String javaLiteral(String value, String type) {
    if (value == null) {
      return "null";
    }
    String trimmed = value.trim();
    if (trimmed.isEmpty()) {
      return "null";
    }
    String kind = type == null ? "" : type;
    if (kind.startsWith("id_String") || kind.startsWith("id_Character")
        || kind.startsWith("id_Password") || kind.startsWith("id_Dynamic")) {
      return "\"" + trimmed.replace("\\", "\\\\").replace("\"", "\\\"") + "\"";
    }
    if (kind.startsWith("id_Boolean")) {
      return trimmed.equalsIgnoreCase("true") ? "true" : "false";
    }
    if (kind.startsWith("id_Date")) {
      Long millis = dateToMillis(trimmed);
      return millis == null ? "null" : "new java.sql.Timestamp(" + millis + "L)";
    }
    if (kind.startsWith("id_BigDecimal")) {
      return "new java.math.BigDecimal(\"" + trimmed + "\")";
    }
    if (kind.startsWith("id_Long") && !trimmed.endsWith("L") && !trimmed.endsWith("l")) {
      return trimmed + "L";
    }
    if ((kind.startsWith("id_Double") || kind.startsWith("id_Float"))
        && !trimmed.contains(".") && !trimmed.contains("E") && !trimmed.contains("e")
        && !trimmed.endsWith("d") && !trimmed.endsWith("f")) {
      return trimmed + ".0";
    }
    return trimmed;
  }

  /** Convierte una fecha `yyyy-MM-dd[ HH:mm:ss]` a milisegundos. */
  public static Long dateToMillis(String value) {
    String[] patterns = {"yyyy-MM-dd HH:mm:ss", "yyyy-MM-dd'T'HH:mm:ss", "yyyy-MM-dd"};
    for (String pattern : patterns) {
      try {
        java.time.format.DateTimeFormatter formatter =
            java.time.format.DateTimeFormatter.ofPattern(pattern);
        return java.time.LocalDateTime.parse(value, formatter)
            .atZone(java.time.ZoneId.systemDefault())
            .toInstant()
            .toEpochMilli();
      } catch (RuntimeException e) {
        // Se prueba con el siguiente patron.
      }
    }
    return null;
  }

  /** Carga una clase de Talend por su nombre. */
  static Class<?> talendClass(String name) throws Exception {
    return TalendClasses.load(name);
  }
}
