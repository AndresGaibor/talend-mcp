package com.andres.talend.bridge.automation;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import com.andres.talend.bridge.BridgeLog;
import com.google.gson.JsonObject;

/** Lectura y montaje de schema/tablas para la prueba de cobertura. */
final class CoverageSchemaSupport {
  private CoverageSchemaSupport() {}

  /**
   * Columnas que debe traer el origen: las del schema fijo del componente, si
   * las tiene, y si no un par de columnas de prueba.
   */
  static List<Map<String, Object>> schemaOfTarget(String targetName) {
    for (Map<String, Object> table : tablesOf(targetName)) {
      Object columns = table.get("columns");
      if (columns instanceof List && !((List<?>) columns).isEmpty()) {
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> typed = (List<Map<String, Object>>) columns;
        return typed;
      }
    }
    List<Map<String, Object>> columns = new ArrayList<>();
    columns.add(schemaColumn("id", "id_Integer"));
    columns.add(schemaColumn("ciudad", "id_String"));
    return columns;
  }

  /** Las tablas (metadata) del nodo. */
  private static List<Map<String, Object>> tablesOf(String uniqueName) {
    try {
      JsonObject schemaSpec = new JsonObject();
      schemaSpec.addProperty("job", CoverageJobFixture.JOB_NAME);
      schemaSpec.addProperty("uniqueName", uniqueName);
      return NodeOperations.schemaOf(schemaSpec);
    } catch (Exception e) {
      BridgeLog.warn("No se pudo leer el schema de '" + uniqueName + "'", e);
      return new ArrayList<>();
    }
  }

  /**
   * Rellena las tablas del plan: una fila por cada columna del schema.
   *
   * El XML de Studio declara las columnas de la tabla con su valor por
   * defecto (el `FORMATS` del tFileOutputPositional, por ejemplo). Sin filas,
   * el codigo generado sale con un hueco: "Syntax error on token '<'".
   */
  static int applyPlannedTables(JsonObject planned, String uniqueName) throws Exception {
    JsonObject tables = new JsonObject();
    for (Map.Entry<String, com.google.gson.JsonElement> entry : planned.entrySet()) {
      com.google.gson.JsonElement raw = entry.getValue();
      if (raw == null || !raw.isJsonObject()) {
        continue;
      }
      com.google.gson.JsonObject definition = raw.getAsJsonObject();
      if (!definition.has("table")) {
        continue;
      }
      com.google.gson.JsonObject table = definition.getAsJsonObject("table");
      // Las columnas son las del nodo: la tabla puede tener mas que las que
      // declara el XML (la FORMATS del tFileOutputPositional anade
      // SCHEMA_COLUMN).
      java.util.Map<String, String> defaults = new java.util.LinkedHashMap<>();
      java.util.List<String> xmlColumns = new java.util.ArrayList<>();
      com.google.gson.JsonArray columns = table.getAsJsonArray("columns");
      if (columns != null) {
        for (com.google.gson.JsonElement rawColumn : columns) {
          com.google.gson.JsonObject column = rawColumn.getAsJsonObject();
          String name = column.has("name") ? column.get("name").getAsString() : "";
          xmlColumns.add(name);
          defaults.put(name, column.has("defaultValue") && !column.get("defaultValue").isJsonNull()
              ? column.get("defaultValue").getAsString()
              : "");
        }
      }
      java.util.List<String> nodeColumns = tableColumnsOf(uniqueName, entry.getKey());
      if (nodeColumns.isEmpty()) {
        nodeColumns = xmlColumns;
      }
      boolean basedOnSchema = table.has("basedOnSchema") && table.get("basedOnSchema").getAsBoolean();
      int rows;
      if (basedOnSchema) {
        rows = schemaColumnsOf(uniqueName).size();
      } else {
        rows = table.has("rows") ? table.get("rows").getAsInt() : 0;
      }
      com.google.gson.JsonArray values = new com.google.gson.JsonArray();
      for (int i = 0; i < rows; i++) {
        com.google.gson.JsonObject row = new com.google.gson.JsonObject();
        for (String code : nodeColumns) {
          row.addProperty(code, defaults.getOrDefault(code, ""));
        }
        values.add(row);
      }
      com.google.gson.JsonObject tableSpec = new com.google.gson.JsonObject();
      tableSpec.add("columns", columnNames(nodeColumns));
      tableSpec.add("rows", values);
      tables.add(entry.getKey(), tableSpec);
    }
    if (tables.size() == 0) {
      return 0;
    }
    JsonObject configureSpec = new JsonObject();
    configureSpec.addProperty("job", CoverageJobFixture.JOB_NAME);
    configureSpec.addProperty("uniqueName", uniqueName);
    configureSpec.add("tables", tables);
    NodeOperations.configure(configureSpec);
    return tables.size();
  }

  /** Columnas de la tabla FLOW del nodo (las que recibe). */
  private static List<Map<String, Object>> schemaColumnsOf(String uniqueName) {
    for (Map<String, Object> table : tablesOf(uniqueName)) {
      Object columns = table.get("columns");
      if (columns instanceof List && !((List<?>) columns).isEmpty()) {
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> typed = (List<Map<String, Object>>) columns;
        return typed;
      }
    }
    return new ArrayList<>();
  }

  /** Codigos de columna de una tabla del nodo. */
  private static List<String> tableColumnsOf(String uniqueName, String tableName) {
    try {
      JsonObject spec = new JsonObject();
      spec.addProperty("job", CoverageJobFixture.JOB_NAME);
      spec.addProperty("uniqueName", uniqueName);
      spec.addProperty("table", tableName);
      return NodeOperations.tableColumns(spec);
    } catch (Exception e) {
      BridgeLog.warn("No se pudieron leer las columnas de la tabla '" + tableName + "'", e);
      return new ArrayList<>();
    }
  }

  /** Los codigos de columna, como array JSON. */
  private static com.google.gson.JsonArray columnNames(List<String> names) {
    com.google.gson.JsonArray array = new com.google.gson.JsonArray();
    for (String name : names) {
      array.add(name);
    }
    return array;
  }

  /** Columna del schema, en el formato del resumen. */
  private static Map<String, Object> schemaColumn(String name, String type) {
    Map<String, Object> column = new LinkedHashMap<>();
    column.put("name", name);
    column.put("type", type);
    return column;
  }

  /** Columna del schema de prueba. */
  static com.google.gson.JsonObject column(String name, String type) {
    com.google.gson.JsonObject column = new com.google.gson.JsonObject();
    column.addProperty("name", name);
    column.addProperty("type", type);
    return column;
  }
}
