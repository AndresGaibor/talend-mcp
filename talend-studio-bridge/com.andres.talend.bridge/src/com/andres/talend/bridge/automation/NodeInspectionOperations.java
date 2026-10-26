package com.andres.talend.bridge.automation;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import com.andres.talend.bridge.UiThread;
import com.google.gson.JsonObject;

/** Consultas de solo lectura al modelo de nodos del editor de Talend. */
final class NodeInspectionOperations {
  private NodeInspectionOperations() {}

  private static <T> T onUi(java.util.concurrent.Callable<T> action) {
    return UiThread.sync(action);
  }

  static List<Map<String, Object>> list(JsonObject spec) throws Exception {
    return onUi(() -> listOnUi(spec));
  }

  private static List<Map<String, Object>> listOnUi(JsonObject spec) throws Exception {
    Object editor = TalendApi.designerEditor(spec);
    Object process = TalendApi.processOf(editor);
    List<Map<String, Object>> nodes = new ArrayList<>();
    // Se listan todos los contenedores, no solo los del lienzo: los nodos de
    // conexion (tDBConnection, tFTPConnection) no aparecen en el lienzo pero
    // forman parte del job.
    for (Object node : TalendApi.allNodes(process)) {
      nodes.add(NodeOperations.summary(node));
    }
    return nodes;
  }

  /**
   * Codigos de columna de una tabla de un nodo.
   *
   * La tabla del nodo puede tener mas columnas que las que declara el XML
   * (la `FORMATS` del tFileOutputPositional anade `SCHEMA_COLUMN`), asi que
   * las filas se tienen que alinear con las del nodo, no con las del XML.
   *
   * @param spec uniqueName del nodo y `table` (nombre de la tabla).
   */
  static List<String> tableColumns(JsonObject spec) throws Exception {
    return onUi(() -> {
      Object editor = TalendApi.designerEditor(spec);
      Object process = TalendApi.processOf(editor);
      String uniqueName = JsonSpec.required(spec, "uniqueName");
      Object node = TalendApi.nodeByUniqueName(process, uniqueName);
      if (node == null) {
        throw new IllegalStateException("No existe el nodo '" + uniqueName + "'");
      }
      String tableName = JsonSpec.required(spec, "table");
      Object parameter = node.getClass().getMethod("getElementParameter", String.class)
          .invoke(node, tableName);
      List<String> codes = new ArrayList<>();
      if (parameter == null) {
        return codes;
      }
      Object raw = parameter.getClass().getMethod("getListItemsDisplayCodeName").invoke(parameter);
      if (raw instanceof Object[]) {
        for (Object code : (Object[]) raw) {
          codes.add(String.valueOf(code));
        }
      }
      return codes;
    });
  }

  /**
   * Tablas (metadata) que el nodo ya trae.
   *
   * Los componentes con schema fijo (el tFileOutputRaw, que solo escribe una
   * columna "content") crean su metadata al nacer: si no se le da al origen el
   * mismo schema, el codigo generado no compila ("content cannot be
   * resolved or is not a field").
   *
   * @param spec uniqueName del nodo.
   */
   static List<Map<String, Object>> schemaOf(JsonObject spec) throws Exception {
    return onUi(() -> schemaOnUi(spec));
  }

  private static List<Map<String, Object>> schemaOnUi(JsonObject spec) throws Exception {
    Object editor = TalendApi.designerEditor(spec);
    Object process = TalendApi.processOf(editor);
    String uniqueName = JsonSpec.required(spec, "uniqueName");
    Object node = TalendApi.nodeByUniqueName(process, uniqueName);
    if (node == null) {
      throw new IllegalStateException("No existe el nodo '" + uniqueName + "'");
    }
    List<Map<String, Object>> tables = new ArrayList<>();
    Object metadata = node.getClass().getMethod("getMetadataList").invoke(node);
    if (!(metadata instanceof Iterable)) {
      return tables;
    }
    for (Object table : (Iterable<?>) metadata) {
      Map<String, Object> item = new LinkedHashMap<>();
      Object connector = table.getClass().getMethod("getAttachedConnector").invoke(table);
      item.put("connector", connector == null ? "FLOW" : String.valueOf(connector));
      Object name = table.getClass().getMethod("getTableName").invoke(table);
      item.put("name", name == null ? "" : String.valueOf(name));
      List<Map<String, Object>> columns = new ArrayList<>();
      Object list = table.getClass().getMethod("getListColumns").invoke(table);
      if (list instanceof Iterable) {
        for (Object column : (Iterable<?>) list) {
          Map<String, Object> columnItem = new LinkedHashMap<>();
          Object label = column.getClass().getMethod("getLabel").invoke(column);
          columnItem.put("name", label == null ? "" : String.valueOf(label));
          Object type = column.getClass().getMethod("getType").invoke(column);
          columnItem.put("type", type == null ? "id_String" : String.valueOf(type));
          columns.add(columnItem);
        }
      }
      item.put("columns", columns);
      tables.add(item);
    }
    return tables;
  }

}

