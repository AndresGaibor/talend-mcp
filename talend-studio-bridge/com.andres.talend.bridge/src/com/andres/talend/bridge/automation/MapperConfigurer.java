package com.andres.talend.bridge.automation;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

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
 *   <outputTables name="row2">
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
 *     { "name": "row2", "reject": false,
 *       "columns": [ { "name": "id", "type": "id_Integer", "expression": "row1.id" } ],
 *       "filter": "row1.monto > 100" }
 *   ],
 *   "vars": [ { "name": "v", "type": "id_String", "expression": "'x'" } ]
 * }
 * ```
 *
 * El `name` de cada entrada y de cada salida es el de su conexion (`row1`,
 * `row2`...), que pone Studio al conectar. Las variables van en la seccion Var:
 * una entrada por variable, con su nombre, tipo y expresion.
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
    String nodeName = nombreDelNodo(node);
    Object externalNode = externalNodeOf(node);
    if (externalNode == null) {
      throw new IllegalStateException("El componente '" + nodeName
          + "' no admite modelo propio: 'mapper' solo se aplica a tMap. Quita 'mapper' de su configuracion");
    }
    Object data = externalNode.getClass().getMethod("getExternalData").invoke(externalNode);
    if (data == null) {
      data = ComponentConfigurator.talendClass(MAPPER_DATA).getConstructor().newInstance();
    }

    // Las tablas se emparejan con las conexiones por nombre. Antes se
    // emparejaban por posicion y el nombre declarado se descartaba: una salida
    // "out1" acababa con la expresion de otra conexion, o con ninguna.
    List<String> entradas = connectionNames(node, "getIncomingConnections");
    List<String> salidas = connectionNames(node, "getOutgoingConnections");

    setTables(data, "setInputTables", spec.get("inputs"), true, entradas, nodeName);
    setTables(data, "setOutputTables", spec.get("outputs"), false, salidas, nodeName);
    setVars(data, spec.get("vars"), nodeName);

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

  /** Rellena una de las listas de tablas del modelo (entradas o salidas). */
  private static void setTables(Object data, String setter, JsonElement raw, boolean isInput,
      List<String> connectionNames, String nodeName) throws Exception {
    if (raw == null || !raw.isJsonArray()) {
      return;
    }
    String tipo = isInput ? "entrada" : "salida";
    List<Object> tables = new ArrayList<>();
    Set<String> usadas = new HashSet<>();
    for (JsonElement entry : raw.getAsJsonArray()) {
      if (!entry.isJsonObject()) {
        continue;
      }
      JsonObject spec = entry.getAsJsonObject();
      String name = nombreDeConexion(JsonSpec.string(spec, "name"), connectionNames, tipo, nodeName);
      if (!usadas.add(name)) {
        throw new IllegalStateException("El tMap '" + nodeName + "' repite la " + tipo + " '" + name + "'");
      }
      tables.add(createTable(spec, isInput, name, nodeName));
    }
    data.getClass().getMethod(setter, List.class).invoke(data, tables);
  }

  /**
   * Nombre real de una tabla del tMap: el de la conexion a la que pertenece.
   *
   * El nombre declarado tiene que ser el de una conexion. Si no lo es, las
   * expresiones no llegan a ninguna conexion y el job no compila, asi que se
   * rechaza y se dicen cuales son los nombres reales.
   *
   * Sin conexiones (el tMap todavia no esta conectado) se usa el declarado.
   */
  private static String nombreDeConexion(String declared, List<String> connectionNames, String tipo,
      String nodeName) {
    if (connectionNames.isEmpty()) {
      return declared == null ? "" : declared;
    }
    if (declared != null && connectionNames.contains(declared)) {
      return declared;
    }
    String campo = tipo.equals("entrada") ? "inputs" : "outputs";
    throw new IllegalStateException("El tMap '" + nodeName + "' declara la " + tipo + " '"
        + (declared == null ? "(sin name)" : declared) + "' y no hay ninguna conexion de " + tipo
        + " con ese nombre. Las conexiones de " + tipo + " son: " + String.join(", ", connectionNames)
        + ". Usa esos nombres en mapper." + campo + "[].name");
  }

  /**
   * Las variables del tMap: su seccion Var es una sola tabla con una entrada
   * por variable (nombre, tipo y expresion).
   */
  private static void setVars(Object data, JsonElement raw, String nodeName) throws Exception {
    if (raw == null || !raw.isJsonArray()) {
      return;
    }
    List<Object> entries = new ArrayList<>();
    for (JsonElement variable : raw.getAsJsonArray()) {
      if (!variable.isJsonObject()) {
        continue;
      }
      JsonObject spec = variable.getAsJsonObject();
      if (JsonSpec.string(spec, "name") == null) {
        throw new IllegalStateException("Una variable del tMap '" + nodeName + "' no tiene name");
      }
      entries.add(createEntry(spec));
    }
    Object table = ComponentConfigurator.talendClass(MAPPER_TABLE).getConstructor().newInstance();
    table.getClass().getMethod("setName", String.class).invoke(table, "Var");
    table.getClass().getMethod("setMetadataTableEntries", List.class).invoke(table, entries);
    List<Object> tables = new ArrayList<>();
    tables.add(table);
    data.getClass().getMethod("setVarsTables", List.class).invoke(data, tables);
  }

  /** El unique name del nodo, para los mensajes. */
  private static String nombreDelNodo(Object node) {
    Object name = TalendApi.invokeOrNull(node, "getUniqueName");
    return name == null ? "?" : String.valueOf(name);
  }

  /**
   * Crea una tabla de entrada o de salida del tMap.
   *
   * @param name nombre real de la tabla: el de la conexion a la que pertenece.
   */
  private static Object createTable(JsonObject spec, boolean isInput, String name, String nodeName)
      throws Exception {
    Object table = ComponentConfigurator.talendClass(MAPPER_TABLE).getConstructor().newInstance();
    table.getClass().getMethod("setName", String.class).invoke(table, name);

    // Sin columnas no hay nada que mapear: Studio genera un struct vacio y el
    // job no compila. Se dice aqui, con el nombre de la tabla.
    JsonElement columns = spec.get("columns");
    if (columns == null || !columns.isJsonArray() || columns.getAsJsonArray().size() == 0) {
      throw new IllegalStateException("La " + (isInput ? "entrada" : "salida") + " '" + name
          + "' del tMap '" + nodeName + "' no tiene columnas: sin esquema no hay nada que mapear."
          + " Declara sus columns con name y type");
    }

    List<Object> entries = new ArrayList<>();
    for (JsonElement column : columns.getAsJsonArray()) {
      if (!column.isJsonObject()) {
        continue;
      }
      entries.add(createEntry(column.getAsJsonObject()));
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
