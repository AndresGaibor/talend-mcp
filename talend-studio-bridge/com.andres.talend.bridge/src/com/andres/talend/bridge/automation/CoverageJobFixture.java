package com.andres.talend.bridge.automation;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import com.andres.talend.bridge.BridgeLog;
import com.google.gson.JsonObject;

/** Job temporal y topologia utilizados para probar componentes. */
final class CoverageJobFixture {
  private CoverageJobFixture() {}

  static final String JOB_NAME = "MCP_Coverage";

  static JsonObject jobSpecOf(String name) {
    JsonObject spec = new JsonObject();
    spec.addProperty("job", name);
    return spec;
  }

  /** Borra y crea de nuevo el job de pruebas, vacio. Va en la UI. */
  static Object recreateJob() throws Exception {
    JsonObject deleteSpec = new JsonObject();
    deleteSpec.addProperty("name", JOB_NAME);
    JobRepository.delete(deleteSpec);
    JsonObject createSpec = new JsonObject();
    createSpec.addProperty("name", JOB_NAME);
    createSpec.addProperty("replace", true);
    return JobRepository.create(createSpec);
  }

  /**
   * Mensaje de la causa raiz. Los metodos se invocan por reflexion, asi que lo
   * que llega es un InvocationTargetException sin mensaje: lo util esta debajo.
   */
  static String rootCause(Throwable error) {
    Throwable cause = error;
    while (cause.getCause() != null && cause.getCause() != cause) {
      cause = cause.getCause();
    }
    String message = cause.getMessage();
    String name = cause.getClass().getSimpleName();
    return message == null || message.isEmpty() ? name : name + ": " + message;
  }

  /**
   * Monta el componente en un job minimo: origen, componente y destino.
   *
   * @param entry el plan de montaje del componente (`source`).
   * @param targetName nombre unico del componente que se mide.
   * @param componentName nombre del componente (para deducir si consume).
   * @return los nombres unicos de los nodos anadidos.
   */
  static List<String> mountTopology(JsonObject entry, String targetName, String componentName)
      throws Exception {
    List<String> added = new ArrayList<>();
    boolean source = entry.has("source")
        ? JsonSpec.booleanOf(entry, "source", false)
        : componentName.endsWith("Output");
    // El conector por el que se entra y el por el que sale: no todos los
    // componentes usan el principal (el tUniqRow saca sus filas por "UNIQUE").
    String input = entry.has("input") ? JsonSpec.string(entry, "input") : "FLOW";
    String output = entry.has("output") ? JsonSpec.string(entry, "output") : "FLOW";
    if (source) {
      added.add(addSource(targetName, input));
    }
    return added;
  }

  /** Genera el codigo del job de cobertura y comprueba que compila. */
  static Map<String, Object> compileJob() {
    try {
      return JobCompiler.check(jobSpecOf(JOB_NAME));
    } catch (Exception e) {
      Map<String, Object> failed = new LinkedHashMap<>();
      failed.put("compiles", false);
      failed.put("error", rootCause(e));
      return failed;
    }
  }

  /**
   * Si el fallo de compilacion es el que pide una conexion de salida.
   *
   * Los componentes de la generacion nueva no declaran sus conectores en el
   * modelo de Studio, y el generador se queja: "Missing output connection for
   * component X".
   */
  static boolean needsOutputConnection(Map<String, Object> checked) {
    Object error = checked.get("error");
    String message = error instanceof Map
        ? String.valueOf(((Map<?, ?>) error).get("message"))
        : String.valueOf(error);
    return message != null && message.contains("Missing output connection");
  }

  /**
   * Anade un tFixedFlowInput con schema y lo conecta con el componente.
   *
   * El schema va antes de conectar: al conectar, Talend rehace las tablas del
   * componente con las del origen. Si el componente tiene schema fijo (el
   * tFileOutputRaw, que solo escribe una columna "content"), el origen tiene
   * que traer las mismas columnas: si no, el codigo no compila.
   */
  private static String addSource(String targetName, String inputConnector) throws Exception {
    JsonObject addSpec = new JsonObject();
    addSpec.addProperty("type", "tFixedFlowInput");
    addSpec.addProperty("job", JOB_NAME);
    Map<String, Object> added = NodeOperations.add(addSpec);
    String sourceName = String.valueOf(added.get("uniqueName"));

    List<Map<String, Object>> columns = CoverageSchemaSupport.schemaOfTarget(targetName);

    JsonObject configureSpec = new JsonObject();
    configureSpec.addProperty("job", JOB_NAME);
    configureSpec.addProperty("uniqueName", sourceName);
    com.google.gson.JsonArray schema = new com.google.gson.JsonArray();
    com.google.gson.JsonObject table = new com.google.gson.JsonObject();
    table.addProperty("connector", "FLOW");
    table.addProperty("name", sourceName);
    com.google.gson.JsonArray jsonColumns = new com.google.gson.JsonArray();
    for (Map<String, Object> column : columns) {
      jsonColumns.add(CoverageSchemaSupport.column(String.valueOf(column.get("name")), String.valueOf(column.get("type"))));
    }
    table.add("columns", jsonColumns);
    schema.add(table);
    configureSpec.add("schema", schema);
    NodeOperations.configure(configureSpec);

    JsonObject connectSpec = new JsonObject();
    connectSpec.addProperty("job", JOB_NAME);
    connectSpec.addProperty("source", sourceName);
    connectSpec.addProperty("target", targetName);
    connectSpec.addProperty("type", inputConnector);
    NodeOperations.connect(connectSpec);
    return sourceName;
  }

  /** Anade un tLogRow y lo conecta con el componente que se mide. */
  static String addSink(String sourceName) throws Exception {
    JsonObject addSpec = new JsonObject();
    addSpec.addProperty("type", "tLogRow");
    addSpec.addProperty("job", JOB_NAME);
    Map<String, Object> added = NodeOperations.add(addSpec);
    String sinkName = String.valueOf(added.get("uniqueName"));

    JsonObject connectSpec = new JsonObject();
    connectSpec.addProperty("job", JOB_NAME);
    connectSpec.addProperty("source", sourceName);
    connectSpec.addProperty("target", sinkName);
    connectSpec.addProperty("type", "FLOW");
    NodeOperations.connect(connectSpec);
    return sinkName;
  }
}
