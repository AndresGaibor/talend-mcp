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

  /** Nombre del job donde se hace la medicion. */
  private static final String JOB_NAME = "MCP_Coverage";

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
  public static Map<String, Object> check(JsonObject spec) throws Exception {
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
    List<String> components = new ArrayList<>();
    Object catalog = UiThread.sync(() -> ComponentCatalog.list(new JsonObject()).get("components"), 60_000L);
    if (catalog instanceof Iterable) {
      for (Object name : (Iterable<?>) catalog) {
        components.add(String.valueOf(name));
      }
    }
    List<String> selected = new ArrayList<>();
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

    // El job donde se prueba.
    UiThread.sync(() -> {
      JsonObject deleteSpec = new JsonObject();
      deleteSpec.addProperty("name", JOB_NAME);
      JobRepository.delete(deleteSpec);
      JsonObject createSpec = new JsonObject();
      createSpec.addProperty("name", JOB_NAME);
      createSpec.addProperty("replace", true);
      return JobRepository.create(createSpec);
    }, 60_000L);

    List<Map<String, Object>> results = new ArrayList<>();
    int created = 0;
    int configured = 0;
    int listed = 0;
    int deleted = 0;
    int failed = 0;
    for (String name : selected) {
      Map<String, Object> row;
      try {
        row = UiThread.sync(() -> checkComponent(name));
      } catch (RuntimeException e) {
        // La UI no atendio a tiempo: el componente queda como fallido, no se aborta todo.
        row = new LinkedHashMap<>();
        row.put("component", name);
        row.put("ok", false);
        row.put("error", e.getMessage() != null ? e.getMessage() : e.toString());
      }
      results.add(row);
      if (Boolean.TRUE.equals(row.get("ok"))) {
        created++;
        if (row.get("parametersApplied") != null) {
          configured++;
        }
        if (Boolean.TRUE.equals(row.get("listed"))) {
          listed++;
        }
        if (Boolean.TRUE.equals(row.get("deleted"))) {
          deleted++;
        }
      } else {
        failed++;
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
    result.put("components", results);
    return result;
  }

  /** Crea, configura, comprueba y borra un componente. Va siempre en la UI. */
  private static Map<String, Object> checkComponent(String name) {
    Map<String, Object> row = new LinkedHashMap<>();
    row.put("component", name);
    try {
      JsonObject addSpec = new JsonObject();
      addSpec.addProperty("type", name);
      // Se opera siempre sobre el job de cobertura, no sobre el que este
      // activo en Studio.
      addSpec.addProperty("job", JOB_NAME);
      Map<String, Object> added = NodeOperations.add(addSpec);
      Object uniqueName = added.get("uniqueName");
      row.put("uniqueName", uniqueName);

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
      int applied = 0;
      for (Map<String, Object> parameter : parameters) {
        if (applied >= 2) {
          break;
        }
        String field = String.valueOf(parameter.get("field"));
        // Solo se prueban los de texto: un CHECK a false puede desactivar
        // el nodo, y Talend entonces lo saca del modelo.
        if (!"TEXT".equals(field)) {
          continue;
        }
        JsonObject value = new JsonObject();
        value.addProperty("value", "prueba");
        values.add(String.valueOf(parameter.get("name")), value);
        applied++;
      }
      if (applied > 0) {
        configSpec.add("parameters", values);
        NodeOperations.configure(configSpec);
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

      // Y se borra, para no dejar el job lleno. Si no se puede borrar, el
      // componente sigue siendo valido: solo queda el job sucio.
      try {
        JsonObject removeSpec = new JsonObject();
        removeSpec.addProperty("job", JOB_NAME);
        com.google.gson.JsonArray names = new com.google.gson.JsonArray();
        names.add(String.valueOf(uniqueName));
        removeSpec.add("uniqueNames", names);
        NodeOperations.delete(removeSpec);
        row.put("deleted", true);
      } catch (Exception e) {
        row.put("deleted", false);
        row.put("deleteError", e.getMessage());
      }
      row.put("ok", true);
    } catch (Exception e) {
      row.put("ok", false);
      row.put("error", e.getMessage() != null ? e.getMessage() : e.toString());
      BridgeLog.warn("Fallo la cobertura del componente '" + name + "'", e);
    }
    return row;
  }
}
