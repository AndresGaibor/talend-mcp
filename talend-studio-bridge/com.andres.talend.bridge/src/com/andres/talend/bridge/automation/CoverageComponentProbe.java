package com.andres.talend.bridge.automation;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import com.andres.talend.bridge.BridgeLog;
import com.google.gson.JsonObject;

/** Crea y verifica un componente dentro del job temporal de cobertura. */
final class CoverageComponentProbe {
  private CoverageComponentProbe() {}

  /**
   * Parametros internos de todo componente: identifican al nodo o describen la
   * definicion. Tocarlos no prueba nada del componente y UNIQUE_NAME renombra
   * el nodo (la prueba lo perdia de vista).
   */
  private static final java.util.Set<String> INTERNAL_PARAMETERS = new java.util.HashSet<>(
      java.util.Arrays.asList("UNIQUE_NAME", "COMPONENT_NAME", "VERSION", "FAMILY", "LABEL",
          "HINT", "CONNECTION_FORMAT", "INFORMATION", "STARTABLE", "SUBTREE_START"));

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

  /** Crea, configura, comprueba y borra un componente. Va siempre en la UI. */
  static Map<String, Object> checkComponent(String name, boolean compile, JsonObject mountEntry) {
    Map<String, Object> row = new LinkedHashMap<>();
    row.put("component", name);
    List<String> mounted = new ArrayList<>();
    try {
      JsonObject addSpec = new JsonObject();
      addSpec.addProperty("type", name);
      // Se opera siempre sobre el job de cobertura, no sobre el que este
      // activo en Studio.
      addSpec.addProperty("job", CoverageJobFixture.JOB_NAME);
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
      configSpec.addProperty("job", CoverageJobFixture.JOB_NAME);
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
      mounted.addAll(CoverageJobFixture.mountTopology(mountEntry, String.valueOf(uniqueName), name));
      row.put("mounted", mounted.size());

      // Las tablas del plan (el FORMATS del tFileOutputPositional, las
      // CONDITIONS del tFilterRow) se rellenan con las columnas del schema,
      // que ya se saben despues de conectar.
      if (plannedTables.size() > 0) {
        int tables = CoverageSchemaSupport.applyPlannedTables(plannedTables, String.valueOf(uniqueName));
        row.put("tablesApplied", tables);
        applied += tables;
        row.put("parametersApplied", applied);
      }

      // Y se comprueba que el nodo esta en el job.
      List<Map<String, Object>> nodes = NodeOperations.list(CoverageJobFixture.jobSpecOf(CoverageJobFixture.JOB_NAME));
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
        Map<String, Object> checked = CoverageJobFixture.compileJob();
        // Los componentes de la generacion nueva (JDBC, Snowflake...) no
        // declaran sus conectores en el modelo, asi que el generador se queja
        // de que les falta la conexion de salida ("Missing output connection
        // for component X"). Se anade un tLogRow y se compila otra vez.
        if (!Boolean.TRUE.equals(checked.get("compiles")) && CoverageJobFixture.needsOutputConnection(checked)) {
          mounted.add(CoverageJobFixture.addSink(String.valueOf(uniqueName)));
          row.put("mounted", mounted.size());
          row.put("outputConnectionAdded", true);
          checked = CoverageJobFixture.compileJob();
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
        removeSpec.addProperty("job", CoverageJobFixture.JOB_NAME);
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
        row.put("deleteError", CoverageJobFixture.rootCause(e));
      }
      row.put("ok", true);
    } catch (Exception e) {
      row.put("ok", false);
      row.put("error", CoverageJobFixture.rootCause(e));
      BridgeLog.warn("Fallo la cobertura del componente '" + name + "'", e);
    }
    return row;
  }
}
