package com.andres.talend.bridge.automation;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import com.andres.talend.bridge.BridgeLog;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

/** Aplica parametros declarativos a los componentes Talend. */
final class ComponentParameterConfigurator {
  private ComponentParameterConfigurator() {}

  static void applyParametersIfEmpty(Object node, JsonObject spec) throws Exception {
    JsonObject parameters = JsonSpec.objectOf(spec, "parameters");
    JsonObject onlyEmpty = new JsonObject();
    for (Map.Entry<String, JsonElement> entry : parameters.entrySet()) {
      if (isEmptyValue(node, entry.getKey())) {
        onlyEmpty.add(entry.getKey(), entry.getValue());
      }
    }
    if (onlyEmpty.size() > 0) {
      applyParameters(node, onlyEmpty);
    }
  }

  /** Si el parametro no existe o esta vacio. */
  private static boolean isEmptyValue(Object node, String name) {
    try {
      Object parameter = node.getClass().getMethod("getElementParameter", String.class)
          .invoke(node, name);
      if (parameter == null) {
        return true;
      }
      Object value = parameter.getClass().getMethod("getValue").invoke(parameter);
      return value == null || String.valueOf(value).trim().isEmpty();
    } catch (Exception e) {
      return true;
    }
  }

  /**
   * Un componente sin salida no puede tener el trigger de error.
   *
   * Con `DIE_ON_ERROR` a true, el generador escribe una llamada al metodo
   * `onSubJobError` del componente, pero ese metodo solo se genera para los
   * componentes que tienen salida. El codigo no compila:
   *
   * ```
   * tFileInputPositional_2_onSubJobError(exception, errorComponent, globalMap);
   * ```
   *
   * Por eso, en un componente que solo recibe, el trigger se deja apagado.
   */
  static void fixErrorTrigger(Object node) {
    try {
      Object parameter = node.getClass().getMethod("getElementParameter", String.class)
          .invoke(node, "DIE_ON_ERROR");
      if (parameter == null) {
        return;
      }
      Object value = parameter.getClass().getMethod("getValue").invoke(parameter);
      if (!"true".equalsIgnoreCase(String.valueOf(value))) {
        return;
      }
      if (!isInputComponent(node)) {
        return;
      }
      parameter.getClass().getMethod("setValue", Object.class).invoke(parameter, "false");
    } catch (Exception e) {
      // Si no se puede decidir, se deja el valor tal cual.
    }
  }

  /**
   * Si el componente solo recibe (no produce).
   *
   * En Talend los componentes que solo leen se llaman `*Input`. Los que
   * producen (los outputs y los de transformacion) tienen el trigger de
   * error y por eso el metodo `onSubJobError` si se genera.
   */
  private static boolean isInputComponent(Object node) {
    return componentNameOf(node).contains("Input");
  }

  /**
   * Deja el `LINK_STYLE` del tMap con un valor valido.
   *
   * Studio no le pone valor: el XML del componente tiene `DEFAULT=""` y, vacio,
   * el tMap queda con un error ("Unknown value in the list [Mapping links display
   * as:]") y al ejecutar el job abre un dialogo modal. `AUTO` es la primera opcion
   * de la lista del componente y el valor por defecto del registro de MCP.
   */
  static void fixMapLinkStyle(Object node) {
    if (!"tMap".equals(componentNameOf(node))) {
      return;
    }
    try {
      Object parameter = node.getClass().getMethod("getElementParameter", String.class)
          .invoke(node, "LINK_STYLE");
      if (parameter == null) {
        return;
      }
      Object value = parameter.getClass().getMethod("getValue").invoke(parameter);
      if (value != null && !String.valueOf(value).isEmpty()) {
        return;
      }
      parameter.getClass().getMethod("setValue", Object.class).invoke(parameter, "AUTO");
    } catch (Exception e) {
      // Si no se puede, se deja el valor tal cual: Studio lo marcara como error.
    }
  }

  /** Nombre del componente del nodo (`tMap`, `tFileInputDelimited`...), o vacio si no se puede leer. */
  private static String componentNameOf(Object node) {
    try {
      Object component = node.getClass().getMethod("getComponent").invoke(node);
      if (component == null) {
        return "";
      }
      return String.valueOf(component.getClass().getMethod("getName").invoke(component));
    } catch (Exception e) {
      return "";
    }
  }

  // ---------------------------------------------------------------------
  // Parametros
  // ---------------------------------------------------------------------

  /**
   * Aplica los parametros del componente.
   *
   * El valor puede venir como texto plano o como objeto con `value` y, si
   * hace falta, `literal` (si es true, el valor se pone entre comillas).
   *
   * Los valores de texto de Talend son literales Java: el generador los
   * escribe tal cual en el codigo, asi que una ruta tiene que ir entre
   * comillas (`"C:/datos/clientes.csv"`) o el codigo no compila. Los
   * booleanos y los numeros van sin comillas.
   */
  static void applyParameters(Object node, JsonObject spec) throws Exception {
    JsonObject parameters = JsonSpec.objectOf(spec, "parameters");
    for (Map.Entry<String, JsonElement> entry : parameters.entrySet()) {
      JsonElement raw = entry.getValue();
      if (raw == null || raw.isJsonNull()) {
        continue;
      }
      JsonObject definition = new JsonObject();
      String value;
      Boolean literal = null;
      boolean lista = false;
      if (raw.isJsonObject()) {
        definition = raw.getAsJsonObject();
        JsonElement element = definition.get("value");
        if (element == null || element.isJsonNull()) {
          continue;
        }
        lista = element.isJsonArray();
        value = element.isJsonPrimitive() ? element.getAsString() : element.toString();
        if (definition.has("literal") && !definition.get("literal").isJsonNull()) {
          literal = definition.get("literal").getAsBoolean();
        }
      } else if (raw.isJsonPrimitive()) {
        value = raw.getAsString();
        definition.addProperty("value", value);
      } else {
        continue;
      }

      Object parameter = node.getClass().getMethod("getElementParameter", String.class)
          .invoke(node, entry.getKey());
      if (parameter == null) {
        // Hay componentes cuyo parametro no aparece en el catalogo hasta que
        // se configura (el `FILENAME` del tFileOutputDelimited, por ejemplo).
        // Se crea con el tipo indicado, que es lo que hace el IDE al migrar
        // un job antiguo.
        parameter = createParameter(node, entry.getKey(), definition);
        if (parameter == null) {
          BridgeLog.warn("El componente no tiene el parametro '" + entry.getKey() + "'");
          continue;
        }
      }
      if (lista) {
        // Los parametros de tipo SCHEMA (el `SCHEMA_FLOW` del tDBOutput, que
        // son las columnas que se escriben) guardan una lista de valores.
        setListValue(parameter, definition.get("value").getAsJsonArray());
        continue;
      }
      parameter.getClass().getMethod("setValue", Object.class)
          .invoke(parameter, valueOf(parameter, value, literal));
      completeProcessReference(node, parameter, value);
    }
  }

  /**
   * Pone una lista de valores en un parametro.
   *
   * El formato en memoria depende del tipo de campo:
   *
   * - Los de tipo SCHEMA (el `SCHEMA_FLOW` del `tDBOutput`, que son las
   *   columnas que se escriben) guardan una lista de
   *   `ElementParameterValueModel`, cada uno con su `label` (el `elementRef`,
   *   "SCHEMA_COLUMN") y su `value` (el nombre de la columna).
   * - Los de tipo TABLE guardan una lista de mapas (una fila por mapa), que es
   *   lo que ya se usa para las tablas de los componentes.
   */
  private static void setListValue(Object parameter, JsonArray valores) throws Exception {
    String fieldType = null;
    try {
      Object tipo = parameter.getClass().getMethod("getFieldType").invoke(parameter);
      fieldType = tipo == null ? null : String.valueOf(tipo);
    } catch (Exception e) {
      // Sin tipo: se usa el formato de las tablas.
    }

    List<Object> lista = new ArrayList<>();
    if (fieldType != null && fieldType.contains("SCHEMA")) {
      Class<?> valueClass = TalendClasses.load("org.talend.core.model.process.ElementParameterValueModel");
      for (JsonElement item : valores) {
        if (!item.isJsonObject()) {
          continue;
        }
        JsonObject objeto = item.getAsJsonObject();
        Object valor = valueClass.getConstructor().newInstance();
        String label = objeto.has("elementRef") ? objeto.get("elementRef").getAsString() : null;
        if (label != null) {
          valor.getClass().getMethod("setLabel", String.class).invoke(valor, label);
        }
        String texto = objeto.has("value") ? objeto.get("value").getAsString() : "";
        valor.getClass().getMethod("setValue", String.class).invoke(valor, texto);
        lista.add(valor);
      }
    } else {
      for (JsonElement item : valores) {
        if (item.isJsonObject()) {
          Map<String, Object> fila = new LinkedHashMap<>();
          for (Map.Entry<String, JsonElement> campo : item.getAsJsonObject().entrySet()) {
            JsonElement valor = campo.getValue();
            fila.put(campo.getKey(), valor.isJsonPrimitive() ? valor.getAsString() : valor.toString());
          }
          lista.add(fila);
        } else if (item.isJsonPrimitive()) {
          lista.add(item.getAsString());
        }
      }
    }
    parameter.getClass().getMethod("setValue", Object.class).invoke(parameter, lista);
  }

  /**
   * Completa la referencia a otro job.
   *
   * Los componentes que lanzan otro job (el tRunJob, el tRunRoutine) guardan
   * la referencia en varios parametros: el `PROCESS` con la etiqueta, y tres
   * parametros tecnicos con el contexto, el id interno del item y la version.
   * Si solo se pone la etiqueta, el job hijo no se encuentra.
   *
   * @param parameter el parametro que se acaba de poner.
   * @param value la etiqueta del job hijo.
   */
  private static void completeProcessReference(Object node, Object parameter, String value) {
    try {
      Object fieldType = parameter.getClass().getMethod("getFieldType").invoke(parameter);
      if (!"PROCESS_TYPE".equals(String.valueOf(fieldType))) {
        return;
      }
      String jobName = value == null ? null : value.replace("\"", "").trim();
      if (jobName == null || jobName.isEmpty()) {
        return;
      }
      String id = TalendApi.internalIdOf(jobName);
      if (id == null) {
        BridgeLog.warn("No se encontro el job '" + jobName + "' en el repositorio");
        return;
      }
      String label = TalendApi.projectLabel();
      setTechnical(node, "PROCESS:PROCESS_TYPE_CONTEXT", "Default");
      setTechnical(node, "PROCESS:PROCESS_TYPE_PROCESS",
          (label == null ? "" : label) + ":" + id);
      setTechnical(node, "PROCESS:PROCESS_TYPE_VERSION", "Latest");
    } catch (Exception e) {
      BridgeLog.warn("No se pudo completar la referencia al job", e);
    }
  }

  /** Pone el valor de un parametro tecnico, creandolo si hace falta. */
  private static void setTechnical(Object node, String name, String value) throws Exception {
    Object parameter = node.getClass().getMethod("getElementParameter", String.class)
        .invoke(node, name);
    if (parameter == null) {
      parameter = createParameter(node, name, technical(name));
    }
    if (parameter != null) {
      parameter.getClass().getMethod("setValue", Object.class).invoke(parameter, value);
    }
  }

  /** Spec de un parametro tecnico, con su tipo de campo. */
  private static JsonObject technical(String name) {
    JsonObject definition = new JsonObject();
    definition.addProperty("field", "TECHNICAL");
    definition.addProperty("value", "");
    return definition;
  }

  /**
   * Valor final de un parametro.
   *
   * Los memos (el codigo Java del tJavaRow, el script del tJava) no son
   * literales: se escriben tal cual en el codigo generado, asi que no se
   * entrecomillan. El resto sigue la regla de los literales Java.
   */
  private static String valueOf(Object parameter, String value, Boolean literal) throws Exception {
    Object fieldType = parameter.getClass().getMethod("getFieldType").invoke(parameter);
    String kind = fieldType == null ? "" : String.valueOf(fieldType);
    // Si se pide el valor entrecomillado, se hace: hay memos que si lo son
    // (la consulta SQL de un tDBInput) y otros que no (el codigo Java del
    // tJavaRow).
    if (literal != null) {
      return ComponentConfigurator.asLiteral(value, literal);
    }
    if (kind.startsWith("MEMO") || kind.startsWith("PROPERTY") || kind.startsWith("EXPRESSION")) {
      return value;
    }
    // Las listas y las referencias a componentes se guardan sin comillas, como
    // las escribe el IDE. Si se entrecomillan, el generador no las reconoce:
    // el `TABLE_ACTION` de un `tDBOutput` vale "TRUNCATE", y con comillas
    // ninguncomparacion del plantilla encaja y la accion no se ejecuta.
    // Lo mismo con la columna a normalizar del `tNormalize`
    // (`PREV_COLUMN_LIST`): con comillas sale `fila."columna"`.
    if (kind.endsWith("_LIST")) {
      return value;
    }
    return ComponentConfigurator.asLiteral(value, literal);
  }

  /**
   * Crea un parametro que el componente no declara.
   *
   * @param field tipo de campo pedido (FILE, TEXT, CHECK...). Si no se indica,
   *        se deduce del valor: una ruta es un FILE.
   */
  private static Object createParameter(Object node, String name, JsonObject definition) {
    try {
      Class<?> parameterClass = TalendClasses.load("org.talend.designer.core.model.components.ElementParameter");
      Class<?> elementClass = TalendClasses.load("org.talend.core.model.process.IElement");
      Object parameter = parameterClass.getConstructor(elementClass).newInstance(node);
      parameter.getClass().getMethod("setName", String.class).invoke(parameter, name);
      parameter.getClass().getMethod("setDisplayName", String.class).invoke(parameter, name);

      Object fieldType = fieldTypeOf(JsonSpec.string(definition, "field"), definition);
      if (fieldType != null) {
        parameter.getClass().getMethod("setFieldType", fieldType.getClass()).invoke(parameter, fieldType);
      }
      parameter.getClass().getMethod("setElement", elementClass).invoke(parameter, node);

      // La lista de parametros del nodo: se sustituye entera para que el
      // nodo se entere del parametro nuevo.
      @SuppressWarnings("unchecked")
      List<Object> parameters = (List<Object>) node.getClass()
          .getMethod("getElementParameters").invoke(node);
      parameters.add(parameter);
      node.getClass().getMethod("setElementParameters", List.class).invoke(node, parameters);
      return parameter;
    } catch (Exception e) {
      BridgeLog.warn("No se pudo crear el parametro '" + name + "'", e);
      return null;
    }
  }

  /** Tipo de campo de un parametro, deducido del spec. */
  private static Object fieldTypeOf(String field, JsonObject definition) {
    String name = field;
    if (name == null || name.trim().isEmpty()) {
      // Sin tipo indicado, una ruta es un fichero y el resto texto.
      String value = JsonSpec.string(definition, "value");
      name = value != null && (value.contains("/") || value.contains("\\")) ? "FILE" : "TEXT";
    }
    try {
      Class<?> typeClass = TalendClasses.load("org.talend.core.model.process.EParameterFieldType");
      for (java.lang.reflect.Field field2 : typeClass.getFields()) {
        if (name.equalsIgnoreCase(field2.getName())) {
          return field2.get(null);
        }
      }
    } catch (Exception e) {
      return null;
    }
    return null;
  }

  /**
   * Convierte un valor en el literal Java que espera el generador.
   *
   * - Si ya viene entrecomillado, se deja.
   * - Si es un booleano, un numero o esta vacio, se deja: en Talend esos
   *   valores no son cadenas.
   * - En cualquier otro caso, se entrecomilla.
   */
}
