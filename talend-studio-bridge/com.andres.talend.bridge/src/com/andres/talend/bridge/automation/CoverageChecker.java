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
    UiThread.sync(CoverageJobFixture::recreateJob, 60_000L);

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
        row = UiThread.sync(() -> CoverageComponentProbe.checkComponent(name, compile, mountEntry), 120_000L);
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
          UiThread.sync(CoverageJobFixture::recreateJob, 60_000L);
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
        cleanup.addProperty("name", CoverageJobFixture.JOB_NAME);
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
}
