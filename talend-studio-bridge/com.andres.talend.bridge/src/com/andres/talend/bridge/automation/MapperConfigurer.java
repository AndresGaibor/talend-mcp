package com.andres.talend.bridge.automation;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import com.andres.talend.bridge.BridgeLog;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

/**
 * Configuracion del tMap: transformaciones, filtros, joins y variables.
 *
 * El tMap es el unico componente cuyo estado no cabe en parametros: sus
 * tablas de entrada y salida, con las expresiones de cada columna, viven en un
 * modelo propio (el `nodeData` del `.item`).
 *
 * En memoria ese modelo es un `ExternalMapperData` con una lista de tablas
 * (`ExternalMapperTable`), y cada tabla con sus entradas
 * (`ExternalMapperTableEntry`). Al guardar, Studio lo convierte a EMF y lo
 * escribe dentro del `<node>`:
 *
 * ```xml
 * <nodeData xsi:type="TalendMapper:MapperData">
 *   <outputTables name="out1">
 *     <mapperTableEntries name="id" expression="row1.id " type="id_Integer"/>
 *   </outputTables>
 *   <inputTables name="row1" matchingMode="UNIQUE_MATCH" lookupMode="LOAD_ONCE">
 *     <mapperTableEntries name="id" type="id_Integer"/>
 *   </inputTables>
 * </nodeData>
 * ```
 *
 * Formato del spec:
 *
 * ```json
 * {
 *   "inputs": [
 *     { "name": "row1", "matchingMode": "UNIQUE_MATCH", "lookupMode": "LOAD_ONCE",
 *       "columns": [ { "name": "id", "type": "id_Integer" } ],
 *       "filter": "row1.estado == 'A'" }
 *   ],
 *   "outputs": [
 *     { "name": "out1", "reject": false,
 *       "columns": [ { "name": "id", "type": "id_Integer", "expression": "row1.id" } ],
 *       "filter": "row1.monto > 100" }
 *   ],
 *   "vars": [ { "name": "v", "type": "id_String", "expression": "'x'" } ]
 * }
 * ```
 */
public final class MapperConfigurer {

  private MapperConfigurer() {}

  private static final String MAPPER_DATA = "org.talend.designer.mapper.external.data.ExternalMapperData";
  private static final String MAPPER_TABLE = "org.talend.designer.mapper.external.data.ExternalMapperTable";
  private static final String MAPPER_ENTRY = "org.talend.designer.mapper.external.data.ExternalMapperTableEntry";

  /**
   * Aplica el modelo del tMap al nodo.
   */
  public static void configure(Object node, JsonObject spec) throws Exception {
    Object externalNode = externalNodeOf(node);
    if (externalNode == null) {
      throw new IllegalStateException(
          "El componente no admite modelo propio: no se puede configurar como tMap");
    }
    Object data = externalNode.getClass().getMethod("getExternalData").invoke(externalNode);
    if (data == null) {
      data = ComponentConfigurator.talendClass(MAPPER_DATA).getConstructor().newInstance();
    }

    // El nombre de una tabla del tMap es el de la conexion a la que pertenece.
    // El conversor empareja por nombre, asi que si el modelo declara "out1" y
    // la conexion se llama "conn_1", las expresiones se pierden.
    List<String> entradas = connectionNames(node, "getIncomingConnections");
    List<String> salidas = connectionNames(node, "getOutgoingConnections");

    setTables(data, "setInputTables", spec.get("inputs"), true, entradas);
    setTables(data, "setOutputTables", spec.get("outputs"), false, salidas);
    setTables(data, "setVarsTables", spec.get("vars"), false, null);

    // El nodo y su external node tienen que apuntar al mismo modelo: el
    // external node es el que se serializa en el `<nodeData>`.
    externalNode.getClass()
        .getMethod("setExternalData", ComponentConfigurator.talendClass("org.talend.core.model.process.IExternalData"))
        .invoke(externalNode, data);
    node.getClass().getMethod("setExternalData",
        ComponentConfigurator.talendClass("org.talend.core.model.process.IExternalData"))
        .invoke(node, data);
  }

  /** Nombres de las conexiones de entrada o de salida de un nodo. */
  private static List<String> connectionNames(Object node, String getter) throws Exception {
    List<String> names = new ArrayList<>();
    Object connections = node.getClass().getMethod(getter).invoke(node);
    if (connections instanceof Iterable) {
      for (Object connection : (Iterable<?>) connections) {
        names.add(String.valueOf(connection.getClass().getMethod("getName").invoke(connection)));
      }
    }
    return names;
  }

  /**
   * External node del componente, creado si el nodo no tiene.
   *
   * El modelo del tMap vive en el `externalNode`, no en el componente del
   * catalogo: el `externalNode` es el que sabe convertirlo a EMF al guardar.
   */
  private static Object externalNodeOf(Object node) throws Exception {
    Object existing = node.getClass().getMethod("getExternalNode").invoke(node);
    if (existing != null) {
      return existing;
    }
    Object component = node.getClass().getMethod("getComponent").invoke(node);
    if (component == null) {
      return null;
    }
    String componentName = String.valueOf(component.getClass().getMethod("getName").invoke(component));
    Class<?> factoryClass = ComponentConfigurator.talendClass(
        "org.talend.core.model.repository.ExternalNodesFactory");
    Object externalNode = factoryClass.getMethod("getInstance").invoke(null, componentName);
    if (externalNode == null) {
      return null;
    }
    Class<?> externalNodeClass = ComponentConfigurator.talendClass(
        "org.talend.core.model.process.IExternalNode");
    node.getClass().getMethod("setExternalNode", externalNodeClass).invoke(node, externalNode);
    // `getExternalNode` sincroniza el external node con el nodo.
    return node.getClass().getMethod("getExternalNode").invoke(node);
  }

  /** Rellena una de las listas de tablas del modelo. */
  private static void setTables(Object data, String setter, JsonElement raw, boolean isInput,
      List<String> connectionNames) throws Exception {
    if (raw == null || !raw.isJsonArray()) {
      return;
    }
    List<Object> tables = new ArrayList<>();
    int index = 0;
    for (JsonElement entry : raw.getAsJsonArray()) {
      if (!entry.isJsonObject()) {
        continue;
      }
      String name = null;
      if (connectionNames != null && index < connectionNames.size()) {
        name = connectionNames.get(index);
      }
      tables.add(createTable(entry.getAsJsonObject(), isInput, name));
      index++;
    }
    data.getClass().getMethod(setter, List.class).invoke(data, tables);
  }

  /**
   * Crea una tabla del tMap (de entrada, de salida o de variables).
   *
   * @param name nombre real de la tabla: el de la conexion a la que pertenece.
   */
  private static Object createTable(JsonObject spec, boolean isInput, String name) throws Exception {
    Object table = ComponentConfigurator.talendClass(MAPPER_TABLE).getConstructor().newInstance();
    String declared = JsonSpec.string(spec, "name");
    table.getClass().getMethod("setName", String.class)
        .invoke(table, name != null ? name : (declared == null ? "" : declared));

    List<Object> entries = new ArrayList<>();
    JsonElement columns = spec.get("columns");
    if (columns != null && columns.isJsonArray()) {
      for (JsonElement column : columns.getAsJsonArray()) {
        if (!column.isJsonObject()) {
          continue;
        }
        entries.add(createEntry(column.getAsJsonObject()));
      }
    }
    table.getClass().getMethod("setMetadataTableEntries", List.class).invoke(table, entries);

    // El filtro de la tabla: la expresion y si esta activa.
    String filter = JsonSpec.string(spec, "filter");
    if (filter != null && !filter.trim().isEmpty()) {
      invoke(table, "setExpressionFilter", String.class, filter);
      invoke(table, "setActivateExpressionFilter", boolean.class, Boolean.TRUE);
    }

    if (isInput) {
      String matchingMode = JsonSpec.string(spec, "matchingMode");
      if (matchingMode != null) {
        invoke(table, "setMatchingMode", String.class, matchingMode);
      }
      String lookupMode = JsonSpec.string(spec, "lookupMode");
      if (lookupMode != null) {
        invoke(table, "setLookupMode", String.class, lookupMode);
      }
      if (spec.has("innerJoin")) {
        invoke(table, "setInnerJoin", boolean.class, spec.get("innerJoin").getAsBoolean());
      }
      if (spec.has("reject")) {
        invoke(table, "setReject", boolean.class, spec.get("reject").getAsBoolean());
      }
      if (spec.has("rejectInnerJoin")) {
        invoke(table, "setRejectInnerJoin", boolean.class, spec.get("rejectInnerJoin").getAsBoolean());
      }
      String joinTable = JsonSpec.string(spec, "isJoinTableOf");
      if (joinTable != null) {
        invoke(table, "setIsJoinTableOf", String.class, joinTable);
      }
    } else {
      if (spec.has("reject")) {
        invoke(table, "setReject", boolean.class, spec.get("reject").getAsBoolean());
      }
      if (spec.has("rejectInnerJoin")) {
        invoke(table, "setRejectInnerJoin", boolean.class, spec.get("rejectInnerJoin").getAsBoolean());
      }
    }
    return table;
  }

  /** Crea una entrada (columna) de una tabla del tMap. */
  private static Object createEntry(JsonObject spec) throws Exception {
    Object entry = ComponentConfigurator.talendClass(MAPPER_ENTRY).getConstructor().newInstance();
    String name = JsonSpec.string(spec, "name");
    if (name != null) {
      entry.getClass().getMethod("setName", String.class).invoke(entry, name);
    }
    String type = JobOperationsService.normalizeColumnType(JsonSpec.string(spec, "type"));
    entry.getClass().getMethod("setType", String.class).invoke(entry, type);
    String expression = JsonSpec.string(spec, "expression");
    if (expression != null) {
      entry.getClass().getMethod("setExpression", String.class).invoke(entry, expression);
    }
    if (spec.has("nullable")) {
      entry.getClass().getMethod("setNullable", boolean.class)
          .invoke(entry, spec.get("nullable").getAsBoolean());
    }
    String operator = JsonSpec.string(spec, "operator");
    if (operator != null) {
      entry.getClass().getMethod("setOperator", String.class).invoke(entry, operator);
    }
    return entry;
  }

  /** Invoca un metodo si existe, sin romper la operacion si no. */
  private static void invoke(Object target, String method, Class<?> type, Object value) {
    try {
      target.getClass().getMethod(method, type).invoke(target, value);
    } catch (Exception e) {
      BridgeLog.warn("El modelo del tMap no tiene el metodo '" + method + "'", e);
    }
  }
}
