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
    if (!(value instanceof org.eclipse.emf.ecore.EObject) || !visited.add(value)) return;

    if ("MetadataTable".equals(value.getClass().getSimpleName())) {
      consumer.accept(value);
      return;
    }
    collectTables(invoke(value, "getOwnedElement"), depth + 1, visited, consumer);
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
}
