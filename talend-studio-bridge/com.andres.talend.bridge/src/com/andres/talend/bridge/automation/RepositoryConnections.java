package com.andres.talend.bridge.automation;

import java.util.ArrayList;
import java.util.Collections;
import java.util.IdentityHashMap;
import java.util.Set;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import com.google.gson.JsonObject;

/** Lectura segura de las conexiones compartidas del repositorio Talend. */
public final class RepositoryConnections {
  private RepositoryConnections() {}

  /**
   * Asigna un schema del repositorio a un nodo del job abierto.
   *
   * `spec`: `job` (nombre), `uniqueName` (nodo), `connectionName`,
   * `schemaName`. Solo asigna schemas de archivo (METADATA_FILE_*); las
   * conexiones de base de datos compartidas de Talend 8 no tienen modelo
   * encontrado, por lo que `tDB*` en modo "Repository" no se puede asignar
   * (documentado en ROADMAP P0 fila 8).
   *
   * La asignacion pone la propiedad SCHEMA del nodo en tipo "Repository":
   * el esquema se resuelve contra el repositorio al compilar, no como
   * columnas copiadas en el `.item`.
   */
  public static Map<String, Object> assign(JsonObject spec) throws Exception {
    String job = string(spec, "job");
    String uniqueName = string(spec, "uniqueName");
    String connectionName = string(spec, "connectionName");
    String schemaName = string(spec, "schemaName");
    if (job == null || uniqueName == null || connectionName == null || schemaName == null) {
      throw new IllegalStateException("Faltan job, uniqueName, connectionName o schemaName");
    }

    Object editor = TalendApi.designerEditor(spec);
    Object process = TalendApi.processOf(editor);
    if (process == null) {
      throw new IllegalStateException("No se encontro el job abierto: " + job);
    }
    Object node = TalendApi.nodeByUniqueName(process, uniqueName);
    if (node == null) {
      throw new IllegalStateException("No existe el nodo '" + uniqueName + "'");
    }

    // Buscar la conexion en el repositorio usando `list`.
    Map<String, Object> listed;
    try {
      listed = list(spec);
    } catch (Exception e) {
      throw new IllegalStateException("No se pudo leer el repositorio: " + e.getMessage());
    }
    @SuppressWarnings("unchecked")
    List<Map<String, Object>> connections = (List<Map<String, Object>>) listed.get("connections");
    String connectionType = null;
    if (connections != null) {
      for (Map<String, Object> c : connections) {
        if (connectionName.equals(c.get("name"))) {
          connectionType = (String) c.get("connectionType");
          break;
        }
      }
    }
    if (connectionType == null) {
      throw new IllegalStateException("Conexion no encontrada en el repositorio: " + connectionName);
    }
    // Solo schemas de archivo por ahora: DB en modo Repository no tiene modelo en Talend 8.
    if (connectionType.toLowerCase().contains("db")) {
      throw new IllegalStateException(
          "La asignacion de schemas DB compartidos no esta disponible en Talend 8 (sin modelo de conexiones DB): usa modo built-in");
    }

    NodeOperations.setRepositorySchema(node, connectionName, schemaName);
    TalendApi.markModified(process);

    return result_assign(process, node, job, uniqueName, connectionName, schemaName);
  }

  private static Map<String, Object> result_assign(Object process, Object node, String job, String uniqueName, String connectionName, String schemaName) {
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("assigned", true);
    result.put("job", job);
    result.put("uniqueName", uniqueName);
    result.put("connectionName", connectionName);
    result.put("schemaName", schemaName);
    return result;
  }

  /**
   * Lista nombres y tipos de conexiones sin exponer parametros, rutas ni credenciales.
   */
  public static Map<String, Object> list(JsonObject spec) throws Exception {
    Object factory = TalendApi.repositoryFactory();
    if (factory == null) {
      throw new IllegalStateException("El repositorio de Talend no esta disponible");
    }

    Object value = factory.getClass().getMethod("getMetadataConnectionsItem").invoke(factory);
    List<Map<String, Object>> connections = new ArrayList<>();
    if (value instanceof Iterable<?>) {
      for (Object item : (Iterable<?>) value) {
        if (item == null) continue;

        Object property = invoke(item, "getProperty");
        Object connection = invoke(item, "getConnection");
        Map<String, Object> entry = new LinkedHashMap<>();
        entry.put("name", stringValue(invoke(property, "getLabel")));
        entry.put("version", stringValue(invoke(property, "getVersion")));
        entry.put("itemType", item.getClass().getSimpleName());

        String connectionType = stringValue(invoke(connection, "getConnectionTypeName"));
        if (connectionType == null || connectionType.isEmpty()) {
          connectionType = connection == null ? null : connection.getClass().getSimpleName();
        }
        entry.put("connectionType", connectionType);
        connections.add(entry);
      }
    }

    Map<String, Object> result = new LinkedHashMap<>();
    result.put("connections", connections);
    result.put("count", connections.size());
    return result;
  }

  /** Lista schemas y columnas compartidos, omitiendo valores de configuracion. */
  public static Map<String, Object> listSchemas(JsonObject spec) throws Exception {
    Object factory = TalendApi.repositoryFactory();
    if (factory == null) {
      throw new IllegalStateException("El repositorio de Talend no esta disponible");
    }

    Object value = factory.getClass().getMethod("getMetadataConnectionsItem").invoke(factory);
    List<Map<String, Object>> schemas = new ArrayList<>();
    if (value instanceof Iterable<?>) {
      for (Object item : (Iterable<?>) value) {
        if (item == null) continue;
        Object property = invoke(item, "getProperty");
        Object connection = invoke(item, "getConnection");
        String connectionName = stringValue(invoke(property, "getLabel"));
        String connectionType = stringValue(invoke(connection, "getConnectionTypeName"));
        if (connectionType == null || connectionType.isEmpty()) {
          connectionType = connection == null ? null : connection.getClass().getSimpleName();
        }

        final String connectionTypeName = connectionType;
        Set<Object> visited = Collections.newSetFromMap(new IdentityHashMap<>());
        collectTables(invoke(connection, "getDataPackage"), 0, visited, table -> {
          Map<String, Object> schema = new LinkedHashMap<>();
          schema.put("connectionName", connectionName);
          schema.put("connectionType", connectionTypeName);
          schema.put("name", firstString(invoke(table, "getLabel"), invoke(table, "getName")));
          schema.put("columns", describeColumns(invoke(table, "getColumns")));
          schemas.add(schema);
        });
      }
    }

    Map<String, Object> result = new LinkedHashMap<>();
    result.put("schemas", schemas);
    result.put("count", schemas.size());
    return result;
  }

  private interface TableConsumer {
    void accept(Object table);
  }

  private static void collectTables(Object value, int depth, Set<Object> visited, TableConsumer consumer) {
    if (value == null || depth > 5) return;
    if (value instanceof Iterable<?>) {
      for (Object child : (Iterable<?>) value) collectTables(child, depth, visited, consumer);
      return;
    }
    if (!esEObject(value) || !visited.add(value)) return;

    if ("MetadataTable".equals(value.getClass().getSimpleName())) {
      consumer.accept(value);
      return;
    }
    collectTables(invoke(value, "getOwnedElement"), depth + 1, visited, consumer);
  }

  /**
   * Si el valor es un EObject de EMF.
   *
   * `EObject` es API restringida de EMF: el bundle no la importa, asi que se
   * comprueba por nombre (igual que en `JobPersistence`). Con la referencia
   * directa, el compilador de Tycho rechaza el plugin.
   */
  private static boolean esEObject(Object value) {
    try {
      return TalendClasses.load("org.eclipse.emf.ecore.EObject").isInstance(value);
    } catch (ClassNotFoundException e) {
      return false;
    }
  }

  private static List<Map<String, Object>> describeColumns(Object value) {
    List<Map<String, Object>> columns = new ArrayList<>();
    if (!(value instanceof Iterable<?>)) return columns;
    for (Object column : (Iterable<?>) value) {
      if (column == null) continue;
      Map<String, Object> item = new LinkedHashMap<>();
      item.put("name", firstString(invoke(column, "getLabel"), invoke(column, "getName")));
      item.put("type", invoke(column, "getTalendType"));
      item.put("sourceType", invoke(column, "getSourceType"));
      item.put("length", invoke(column, "getLength"));
      item.put("precision", invoke(column, "getPrecision"));
      item.put("nullable", invoke(column, "isNullable"));
      item.put("key", invoke(column, "isKey"));
      columns.add(item);
    }
    return columns;
  }

  private static String firstString(Object first, Object second) {
    String value = stringValue(first);
    return value == null || value.isEmpty() ? stringValue(second) : value;
  }

  private static Object invoke(Object target, String methodName) {
    if (target == null) return null;
    try {
      return target.getClass().getMethod(methodName).invoke(target);
    } catch (Exception ignored) {
      return null;
    }
  }

  private static String stringValue(Object value) {
    return value == null ? null : String.valueOf(value);
  }

  private static String string(JsonObject spec, String key) {
    return JsonSpec.string(spec, key);
  }

  /** Compatibilidad: nombre via reflexion sin importar EMF. */
  static String invokeName(Object target, String methodName) {
    if (target == null) return null;
    try {
      Object value = target.getClass().getMethod(methodName).invoke(target);
      return value == null ? null : String.valueOf(value);
    } catch (Exception ignored) {
      return null;
    }
  }
}
