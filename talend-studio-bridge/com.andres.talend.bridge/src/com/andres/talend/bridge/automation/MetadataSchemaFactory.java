package com.andres.talend.bridge.automation;

import java.util.ArrayList;
import java.util.List;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

/** Construccion de tablas y columnas de metadata Talend. */
final class MetadataSchemaFactory {
  private MetadataSchemaFactory() {}

  static void setColumnsOf(Object table, JsonArray columns) throws Exception {
    Class<?> columnClass = ComponentConfigurator.talendClass("org.talend.core.model.metadata.MetadataColumn");
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
      // El nombre de la columna en la base de datos. Sin esto, `getColumnName()`
      // devuelve null y el `tDBOutput` genera el INSERT con los nombres de
      // columna a null ("INSERT INTO tabla (null,null)").
      column.getClass().getMethod("setOriginalDbColumnName", String.class).invoke(column, columnName);
      String type = ColumnTypes.normalize(JsonSpec.string(definition, "type"));
      column.getClass().getMethod("setType", String.class).invoke(column, type);
      column.getClass().getMethod("setTalendType", String.class).invoke(column, type);
      columnas.add(column);
    }
    table.getClass().getMethod("setListColumns", List.class).invoke(table, columnas);
  }

  /**
   * Crea la tabla de metadata con sus columnas.
   *
   * El `tableName` tiene que ser el unique name del nodo, como en los jobs
   * que escribe el IDE. Con otro nombre, Studio no serializa el metadata.
   */
  static Object createMetadataTable(String connector, String name, JsonArray columns)
      throws Exception {
    Class<?> tableClass = ComponentConfigurator.talendClass("org.talend.core.model.metadata.MetadataTable");
    Object table = tableClass.getConstructor().newInstance();

    Class<?> columnClass = ComponentConfigurator.talendClass("org.talend.core.model.metadata.MetadataColumn");
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
      // El nombre de la columna en la base de datos (ver `setColumnsOf`).
      column.getClass().getMethod("setOriginalDbColumnName", String.class).invoke(column, columnName);
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

}

