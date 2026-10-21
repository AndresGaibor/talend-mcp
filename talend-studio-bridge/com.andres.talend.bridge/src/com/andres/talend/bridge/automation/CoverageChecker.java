package com.andres.talend.bridge.automation;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import com.andres.talend.bridge.BridgeLog;
import com.andres.talend.bridge.UiThread;

import com.google.gson.JsonObject;

/**
 * Mide quantos componentes del catalogo se pueden crear y configurar.
 *
 * La configuracion de un componente es generica (parametros, tablas, schema y
 * modelo), asi que la pregunta es: aguanta el mecanismo con los mil y pico
 * componentes que trae Talend?
 *
 * La medicion se hace en un solo job de pruebas: se anade un componente, se
 * comprueba que sale, se configura con dos de sus parametros y se borra. Al
 * final el job queda vacio.
 */
public final class CoverageChecker {

  private CoverageChecker() {}

  /** Estado de una medicion en marcha o terminada. */
  private static final class Run {
    final String id = java.util.UUID.randomUUID().toString().substring(0, 8);
    final long startedAt = System.currentTimeMillis();
    volatile long finishedAt;
    volatile String state = "running";
    volatile int catalogSize;
    volatile int total;
    volatile int tested;
    volatile int created;
    volatile int failed;
    volatile int saveFailed;
    volatile int resets;
    volatile boolean compile;
    volatile int compiled;
    volatile String current;
    volatile boolean cancelRequested;
    volatile String error;
    volatile Map<String, Object> result;

    Map<String, Object> snapshot(boolean withResult) {
      Map<String, Object> out = new LinkedHashMap<>();
      out.put("runId", id);
      out.put("state", state);
      out.put("catalogSize", catalogSize);
      out.put("total", total);
      out.put("tested", tested);
      out.put("created", created);
      out.put("failed", failed);
      out.put("saveFailed", saveFailed);
      out.put("resets", resets);
      out.put("compile", compile);
      out.put("compiled", compiled);
      out.put("current", current);
      long end = finishedAt != 0 ? finishedAt : System.currentTimeMillis();
      out.put("elapsedMs", end - startedAt);
      if (error != null) {
        out.put("error", error);
      }
      if (withResult && result != null) {
        out.put("result", result);
      }
      return out;
    }
  }

  /** La medicion actual o la ultima: solo hay una a la vez. */
  private static volatile Run active;

  /**
   * Arranca la medicion en un hilo aparte y devuelve enseguida.
   *
   * Recorre mil y pico componentes y tarda minutos: una peticion HTTP no
   * aguanta tanto (los clientes cortan a los 5 min), asi que el resultado se
   * consulta con {@link #status}. Si ya hay una en marcha, devuelve esa.
   */
  public static synchronized Map<String, Object> start(JsonObject spec) {
    Run current = active;
    if (current != null && "running".equals(current.state)) {
      Map<String, Object> out = current.snapshot(false);
      out.put("alreadyRunning", true);
      return out;
    }

    Run run = new Run();
    active = run;
    Thread thread = new Thread(() -> {
      try {
        run.result = measure(spec, run);
        run.state = run.cancelRequested ? "cancelled" : "done";
      } catch (Throwable t) {
        run.state = "failed";
        run.error = t.getMessage() != null ? t.getMessage() : t.toString();
        BridgeLog.warn("Fallo la medicion de cobertura", t);
      } finally {
        run.finishedAt = System.currentTimeMillis();
      }
    }, "talend-bridge-coverage");
    thread.setDaemon(true);
    thread.start();
    return run.snapshot(false);
  }

  /**
   * Progreso de la medicion y, cuando termina, su informe.
   *
   * @param spec opcionalmente `cancel: true` para pedir que pare.
   */
  public static Map<String, Object> status(JsonObject spec) {
    Run run = active;
    if (run == null) {
      Map<String, Object> out = new LinkedHashMap<>();
      out.put("state", "none");
      out.put("message", "No hay ninguna medicion de cobertura: arranca una con talend_studio_coverage");
      return out;
    }
    if (spec != null && spec.has("cancel") && spec.get("cancel").getAsBoolean()) {
      run.cancelRequested = true;
    }
    return run.snapshot(true);
  }

  /** Nombre del job donde se hace la medicion. */
  private static final String JOB_NAME = "MCP_Coverage";

  /**
   * Parametros internos de todo componente: identifican al nodo o describen la
   * definicion. Tocarlos no prueba nada del componente y UNIQUE_NAME renombra
   * el nodo (la prueba lo perdia de vista).
   */
  private static final java.util.Set<String> INTERNAL_PARAMETERS = new java.util.HashSet<>(
      java.util.Arrays.asList("UNIQUE_NAME", "COMPONENT_NAME", "VERSION", "FAMILY", "LABEL",
          "HINT", "CONNECTION_FORMAT", "INFORMATION", "STARTABLE", "SUBTREE_START"));

  /** Spec que apunta al job de la medicion. */
  private static JsonObject jobSpecOf(String name) {
    JsonObject spec = new JsonObject();
    spec.addProperty("job", name);
    return spec;
  }

  /**
   * Recorre el catalogo y comprueba que cada componente se puede crear,
   * configurar y borrar.
   *
   * @param spec opcionalmente `filter` (texto que tiene que aparecer en el
   *        nombre) y `max` (maximo de componentes a probar).
   */
  private static Map<String, Object> measure(JsonObject spec, Run run) throws Exception {
    String filter = JsonSpec.string(spec, "filter");
    int max = 100000;
    String rawMax = JsonSpec.string(spec, "max");
    if (rawMax != null) {
      try {
        max = Integer.parseInt(rawMax);
      } catch (NumberFormatException e) {
        max = 100000;
      }
    }

    // Cada paso cede la UI al terminar: Studio sigue respondiendo mientras dura
    // la medicion. Esta clase NO debe llamarse desde el hilo de la UI.
    // L4: ademas de crear y configurar, generar el codigo y compilarlo (unos 2 s mas por componente).
    boolean compile = spec.has("compile") && spec.get("compile").getAsBoolean();
    run.compile = compile;

    // El MCP manda el plan de montaje de cada componente: que parametros
    // obligatorios hay que rellenar (los saca de la definicion XML del
    // componente) y si hay que conectarle un origen o un destino.
    JsonObject mount = JsonSpec.objectOf(spec, "mount");

    List<String> components = new ArrayList<>();
    Object catalog = UiThread.sync(() -> ComponentCatalog.list(new JsonObject()).get("components"), 60_000L);
    if (catalog instanceof Iterable) {
      for (Object name : (Iterable<?>) catalog) {
        components.add(String.valueOf(name));
      }
    }
    List<String> selected = new ArrayList<>();
    // El MCP puede mandar la lista exacta de componentes a medir (por
    // ejemplo, los de una familia): entonces se mide esa y no el catalogo.
    com.google.gson.JsonArray requested = JsonSpec.rawArray(spec, "components");
    if (requested != null && requested.size() > 0) {
      for (com.google.gson.JsonElement element : requested) {
        if (element.isJsonPrimitive()) {
          selected.add(element.getAsString());
        }
      }
      if (selected.size() > max) {
        selected = new ArrayList<>(selected.subList(0, max));
      }
    } else {
      for (String name : components) {
        if (filter != null && !filter.trim().isEmpty()
            && !name.toLowerCase().contains(filter.toLowerCase())) {
          continue;
        }
        selected.add(name);
        if (selected.size() >= max) {
          break;
        }
      }
    }

    run.total = selected.size();
    run.catalogSize = components.size();

    // El job donde se prueba.
    UiThread.sync(CoverageChecker::recreateJob, 60_000L);

    List<Map<String, Object>> results = new ArrayList<>();
    int created = 0;
    int configured = 0;
    int listed = 0;
    int deleted = 0;
    int failed = 0;
    for (String name : selected) {
      if (run.cancelRequested) {
        break;
      }
      run.current = name;
      Map<String, Object> row;
      JsonObject mountEntry = JsonSpec.objectOf(mount, name);
      try {
        row = UiThread.sync(() -> checkComponent(name, compile, mountEntry), 120_000L);
      } catch (RuntimeException e) {
        // La UI no atendio a tiempo: el componente queda como fallido, no se aborta todo.
        row = new LinkedHashMap<>();
        row.put("component", name);
        row.put("ok", false);
        row.put("error", e.getMessage() != null ? e.getMessage() : e.toString());
      }
      results.add(row);
      run.tested = results.size();

      // Un componente que falla puede dejar el job en un estado que rompe el
      // guardado y el borrado de todos los siguientes (se vio: tras el primer
      // fallo, los mil siguientes salian "no guardado"). Se parte de un job
      // limpio para que cada componente se mida por separado.
      boolean dirty = !Boolean.TRUE.equals(row.get("ok"))
          || Boolean.FALSE.equals(row.get("saved"))
          || !Boolean.TRUE.equals(row.get("deleted"));
      if (dirty) {
        try {
          UiThread.sync(CoverageChecker::recreateJob, 60_000L);
          run.resets++;
        } catch (RuntimeException e) {
          BridgeLog.warn("No se pudo reiniciar el job de cobertura", e);
        }
      }
      if (Boolean.TRUE.equals(row.get("ok"))) {
        created++;
        run.created = created;
        if (Boolean.FALSE.equals(row.get("saved"))) {
          run.saveFailed++;
        }
        if (row.get("parametersApplied") != null) {
          configured++;
        }
        if (Boolean.TRUE.equals(row.get("listed"))) {
          listed++;
        }
        if (Boolean.TRUE.equals(row.get("deleted"))) {
          deleted++;
        }
        if (Boolean.TRUE.equals(row.get("compiles"))) {
          run.compiled++;
        }
      } else {
        failed++;
        run.failed = failed;
      }
    }

    // Se deja el proyecto como estaba.
    try {
      UiThread.sync(() -> {
        JsonObject cleanup = new JsonObject();
        cleanup.addProperty("name", JOB_NAME);
        return JobRepository.delete(cleanup);
      }, 60_000L);
    } catch (RuntimeException e) {
      BridgeLog.warn("No se pudo borrar el job de cobertura", e);
    }

    Map<String, Object> result = new LinkedHashMap<>();
    result.put("catalogSize", components.size());
    result.put("tested", results.size());
    result.put("created", created);
    result.put("configured", configured);
    result.put("listed", listed);
    result.put("deleted", deleted);
    result.put("failed", failed);
    result.put("saveFailed", run.saveFailed);
    result.put("compile", compile);
    result.put("compiled", run.compiled);
    result.put("cancelled", run.cancelRequested);
    result.put("components", results);
    return result;
  }

  /**
   * Valor de prueba para un parametro obligatorio, o null si no se sabe darle uno
   * sin romperlo (listas, casillas, tablas, numeros...).
   */
  private static String testValueFor(String field, String name, String defaultValue) {
    boolean numeric = defaultValue != null && defaultValue.matches("-?\\d+(\\.\\d+)?");
    boolean bool = "true".equals(defaultValue) || "false".equals(defaultValue);
    if (numeric || bool) {
      return null;
    }
    switch (field) {
      case "FILE":
        return "C:/tmp/mcp_coverage/" + name.toLowerCase() + ".dat";
      case "DIRECTORY":
        return "C:/tmp/mcp_coverage";
      case "TEXT":
        return "prueba";
      default:
        return null;
    }
  }

  /** Borra y crea de nuevo el job de pruebas, vacio. Va en la UI. */
  private static Object recreateJob() throws Exception {
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
  private static String rootCause(Throwable error) {
    Throwable cause = error;
    while (cause.getCause() != null && cause.getCause() != cause) {
      cause = cause.getCause();
    }
    String message = cause.getMessage();
    String name = cause.getClass().getSimpleName();
    return message == null || message.isEmpty() ? name : name + ": " + message;
  }

  /** Crea, configura, comprueba y borra un componente. Va siempre en la UI. */
  private static Map<String, Object> checkComponent(String name, boolean compile, JsonObject mountEntry) {
    Map<String, Object> row = new LinkedHashMap<>();
    row.put("component", name);
    List<String> mounted = new ArrayList<>();
    try {
      JsonObject addSpec = new JsonObject();
      addSpec.addProperty("type", name);
      // Se opera siempre sobre el job de cobertura, no sobre el que este
      // activo en Studio.
      addSpec.addProperty("job", JOB_NAME);
      Map<String, Object> added = NodeOperations.add(addSpec);
      Object uniqueName = added.get("uniqueName");
      row.put("uniqueName", uniqueName);
      // Studio puede crear el nodo y no poder guardarlo (los de Spark revientan
      // al evaluar sus expresiones de modo en saveXmlFile).
      row.put("saved", added.get("saved"));

      // Se configura con dos parametros de texto del componente.
      List<Map<String, Object>> parameters = new ArrayList<>();
      JsonObject parameterSpec = new JsonObject();
      parameterSpec.addProperty("name", name);
      Object raw = ComponentCatalog.parameters(parameterSpec).get("parameters");
      if (raw instanceof Iterable) {
        for (Object parameter : (Iterable<?>) raw) {
          if (parameter instanceof Map) {
            @SuppressWarnings("unchecked")
            Map<String, Object> item = (Map<String, Object>) parameter;
            parameters.add(item);
          }
        }
      }
      JsonObject configSpec = new JsonObject();
      configSpec.addProperty("uniqueName", String.valueOf(uniqueName));
      configSpec.addProperty("job", JOB_NAME);
      JsonObject values = new JsonObject();

      // Los parametros obligatorios los decide el MCP: lee la definicion XML
      // del componente (REQUIRED, DEFAULT y SHOW_IF) y dice que valor poner en
      // cada uno. Sin ellos el codigo generado no compila (un
      // tFileOutputDelimited sin FILENAME da "The constructor File() is
      // undefined"). Si el MCP no manda plan, se usa la lista del catalogo de
      // Studio: sus parametros obligatorios, visibles y editables, y de tipo
      // texto o archivo (un CHECK a false puede desactivar el nodo y Talend lo
      // saca del modelo, y un numero no admite una cadena).
      JsonObject planned = JsonSpec.objectOf(mountEntry, "parameters");
      // Las tablas van aparte: se rellenan despues de conectar, cuando ya se
      // sabe cuantas columnas tiene el schema.
      JsonObject plannedValues = new JsonObject();
      JsonObject plannedTables = new JsonObject();
      for (Map.Entry<String, com.google.gson.JsonElement> entry : planned.entrySet()) {
        com.google.gson.JsonElement plannedValue = entry.getValue();
        boolean isTable = plannedValue != null && plannedValue.isJsonObject()
            && plannedValue.getAsJsonObject().has("table");
        if (isTable) {
          plannedTables.add(entry.getKey(), plannedValue);
        } else {
          plannedValues.add(entry.getKey(), plannedValue);
        }
      }
      int applied = 0;

      if (plannedValues.size() > 0) {
        configSpec.add("parameters", plannedValues);
        // Solo donde el nodo no tiene valor: el que Studio pone por defecto
        // manda.
        configSpec.addProperty("onlyIfEmpty", true);
        Map<String, Object> configuredNode = NodeOperations.configure(configSpec);
        applied = plannedValues.size();
        row.put("parametersApplied", applied);
        Object after = configuredNode.get("uniqueName");
        if (after != null && !String.valueOf(uniqueName).equals(String.valueOf(after))) {
          throw new IllegalStateException("Configurar cambio el nombre del nodo: "
              + uniqueName + " -> " + after);
        }
      } else {
        for (Map<String, Object> parameter : parameters) {
          String field = String.valueOf(parameter.get("field"));
          String parameterName = String.valueOf(parameter.get("name"));
          if (INTERNAL_PARAMETERS.contains(parameterName)) {
            continue;
          }
          if (!Boolean.TRUE.equals(parameter.get("required"))
              || !Boolean.TRUE.equals(parameter.get("show"))
              || Boolean.TRUE.equals(parameter.get("readOnly"))) {
            continue;
          }
          String testValue = testValueFor(field, parameterName, String.valueOf(parameter.get("default")));
          if (testValue == null) {
            continue;
          }
          JsonObject value = new JsonObject();
          value.addProperty("value", testValue);
          values.add(parameterName, value);
          applied++;
        }

        // Sin obligatorios (o sin compilar) se mantiene la prueba original: dos
        // parametros de texto cualquiera, para comprobar que se configura.
        if (applied == 0 && !compile) {
          for (Map<String, Object> parameter : parameters) {
            if (applied >= 2) {
              break;
            }
            String parameterName = String.valueOf(parameter.get("name"));
            if (!"TEXT".equals(String.valueOf(parameter.get("field"))) || INTERNAL_PARAMETERS.contains(parameterName)) {
              continue;
            }
            JsonObject value = new JsonObject();
            value.addProperty("value", "prueba");
            values.add(parameterName, value);
            applied++;
          }
        }
        if (applied > 0) {
          configSpec.add("parameters", values);
          Map<String, Object> configuredNode = NodeOperations.configure(configSpec);
          row.put("parametersApplied", applied);
          // Configurar no puede cambiar la identidad del nodo.
          Object after = configuredNode.get("uniqueName");
          if (after != null && !String.valueOf(uniqueName).equals(String.valueOf(after))) {
            throw new IllegalStateException("Configurar cambio el nombre del nodo: "
                + uniqueName + " -> " + after);
          }
        }
      }

      // L3: el componente se monta en un job minimo. Uno que consume necesita
      // un origen (un tFixedFlowInput con schema). El destino (un tLogRow) se
      // anade mas abajo, solo si el generador lo pide.
      mounted.addAll(mountTopology(mountEntry, String.valueOf(uniqueName), name));
      row.put("mounted", mounted.size());

      // Las tablas del plan (el FORMATS del tFileOutputPositional, las
      // CONDITIONS del tFilterRow) se rellenan con las columnas del schema,
      // que ya se saben despues de conectar.
      if (plannedTables.size() > 0) {
        int tables = applyPlannedTables(plannedTables, String.valueOf(uniqueName));
        row.put("tablesApplied", tables);
        applied += tables;
        row.put("parametersApplied", applied);
      }

      // Y se comprueba que el nodo esta en el job.
      List<Map<String, Object>> nodes = NodeOperations.list(jobSpecOf(JOB_NAME));
      boolean found = false;
      for (Map<String, Object> node : nodes) {
        if (String.valueOf(uniqueName).equals(String.valueOf(node.get("uniqueName")))) {
          found = true;
          break;
        }
      }
      row.put("listed", found);

      // L4: el codigo que Studio genera para este componente, compila.
      if (compile) {
        Map<String, Object> checked = compileJob();
        // Los componentes de la generacion nueva (JDBC, Snowflake...) no
        // declaran sus conectores en el modelo, asi que el generador se queja
        // de que les falta la conexion de salida ("Missing output connection
        // for component X"). Se anade un tLogRow y se compila otra vez.
        if (!Boolean.TRUE.equals(checked.get("compiles")) && needsOutputConnection(checked)) {
          mounted.add(addSink(String.valueOf(uniqueName)));
          row.put("mounted", mounted.size());
          row.put("outputConnectionAdded", true);
          checked = compileJob();
        }
        row.put("compiles", checked.get("compiles"));
        if (checked.get("error") instanceof Map) {
          row.put("compileError", ((Map<?, ?>) checked.get("error")).get("message"));
        }
      }

      // Y se borra, para no dejar el job lleno. Si no se puede borrar, el
      // componente sigue siendo valido: solo queda el job sucio.
      try {
        JsonObject removeSpec = new JsonObject();
        removeSpec.addProperty("job", JOB_NAME);
        com.google.gson.JsonArray names = new com.google.gson.JsonArray();
        for (String mountedName : mounted) {
          names.add(mountedName);
        }
        names.add(String.valueOf(uniqueName));
        removeSpec.add("uniqueNames", names);
        NodeOperations.delete(removeSpec);
        row.put("deleted", true);
      } catch (Exception e) {
        row.put("deleted", false);
        row.put("deleteError", rootCause(e));
      }
      row.put("ok", true);
    } catch (Exception e) {
      row.put("ok", false);
      row.put("error", rootCause(e));
      BridgeLog.warn("Fallo la cobertura del componente '" + name + "'", e);
    }
    return row;
  }

  /**
   * Monta el componente en un job minimo: origen, componente y destino.
   *
   * @param entry el plan de montaje del componente (`source`).
   * @param targetName nombre unico del componente que se mide.
   * @param componentName nombre del componente (para deducir si consume).
   * @return los nombres unicos de los nodos anadidos.
   */
  private static List<String> mountTopology(JsonObject entry, String targetName, String componentName)
      throws Exception {
    List<String> added = new ArrayList<>();
    boolean source = entry.has("source")
        ? JsonSpec.booleanOf(entry, "source", false)
        : componentName.endsWith("Output");
    if (source) {
      added.add(addSource(targetName));
    }
    return added;
  }

  /** Genera el codigo del job de cobertura y comprueba que compila. */
  private static Map<String, Object> compileJob() {
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
  private static boolean needsOutputConnection(Map<String, Object> checked) {
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
  private static String addSource(String targetName) throws Exception {
    JsonObject addSpec = new JsonObject();
    addSpec.addProperty("type", "tFixedFlowInput");
    addSpec.addProperty("job", JOB_NAME);
    Map<String, Object> added = NodeOperations.add(addSpec);
    String sourceName = String.valueOf(added.get("uniqueName"));

    List<Map<String, Object>> columns = schemaOfTarget(targetName);

    JsonObject configureSpec = new JsonObject();
    configureSpec.addProperty("job", JOB_NAME);
    configureSpec.addProperty("uniqueName", sourceName);
    com.google.gson.JsonArray schema = new com.google.gson.JsonArray();
    com.google.gson.JsonObject table = new com.google.gson.JsonObject();
    table.addProperty("connector", "FLOW");
    table.addProperty("name", sourceName);
    com.google.gson.JsonArray jsonColumns = new com.google.gson.JsonArray();
    for (Map<String, Object> column : columns) {
      jsonColumns.add(column(String.valueOf(column.get("name")), String.valueOf(column.get("type"))));
    }
    table.add("columns", jsonColumns);
    schema.add(table);
    configureSpec.add("schema", schema);
    NodeOperations.configure(configureSpec);

    JsonObject connectSpec = new JsonObject();
    connectSpec.addProperty("job", JOB_NAME);
    connectSpec.addProperty("source", sourceName);
    connectSpec.addProperty("target", targetName);
    connectSpec.addProperty("type", "FLOW");
    NodeOperations.connect(connectSpec);
    return sourceName;
  }

  /**
   * Columnas que debe traer el origen: las del schema fijo del componente, si
   * las tiene, y si no un par de columnas de prueba.
   */
  private static List<Map<String, Object>> schemaOfTarget(String targetName) {
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
      schemaSpec.addProperty("job", JOB_NAME);
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
  private static int applyPlannedTables(JsonObject planned, String uniqueName) throws Exception {
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
    configureSpec.addProperty("job", JOB_NAME);
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
      spec.addProperty("job", JOB_NAME);
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

  /** Anade un tLogRow y lo conecta con el componente que se mide. */
  private static String addSink(String sourceName) throws Exception {
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

  /** Columna del schema de prueba. */
  private static com.google.gson.JsonObject column(String name, String type) {
    com.google.gson.JsonObject column = new com.google.gson.JsonObject();
    column.addProperty("name", name);
    column.addProperty("type", type);
    return column;
  }
}
