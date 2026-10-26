package com.andres.talend.bridge.automation;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import com.andres.talend.bridge.BridgeLog;

import com.google.gson.JsonObject;

/**
 * Contextos de un job: los entornos ("Default", "produccion"...) y las
 * variables de cada entorno, con su valor.
 *
 * Se editan con la API de Studio, no escribiendo el XML a mano: asi el `.item`
 * que guarda Studio es el que espera el IDE, y el job se abre sin avisos.
 *
 * La API de Studio (org.talend.core.model.context):
 *
 * - `JobContextManager.getListContext()`: los contextos del job.
 * - `JobContextManager.getDefaultContext()`: el entorno por defecto.
 * - `JobContext.getContextParameterList()`: las variables del entorno.
 * - `JobContext.getContextParameter(nombre)`: una variable.
 * - `JobContextParameter.setName/setType/setValue`: una variable.
 */
public final class JobContexts {

  private JobContexts() {}

  /**
   * Los contextos del job con sus variables.
   *
   * @param spec `job` opcional (si no, el job activo).
   */
  public static Map<String, Object> list(JsonObject spec) throws Exception {
    Object editor = TalendApi.designerEditor(spec);
    Object process = TalendApi.processOf(editor);
    Object manager = contextManager(process);
    Object defaultContext = manager.getClass().getMethod("getDefaultContext").invoke(manager);

    List<Map<String, Object>> contexts = new ArrayList<>();
    for (Object context : contextsOf(manager)) {
      Map<String, Object> item = new LinkedHashMap<>();
      item.put("name", String.valueOf(context.getClass().getMethod("getName").invoke(context)));
      item.put("isDefault", context == defaultContext);
      item.put("hidden", Boolean.TRUE.equals(context.getClass().getMethod("isHide").invoke(context)));
      item.put("confirmationNeeded",
          Boolean.TRUE.equals(context.getClass().getMethod("isConfirmationNeeded").invoke(context)));
      List<Map<String, Object>> parameters = new ArrayList<>();
      for (Object parameter : parametersOf(context)) {
        Map<String, Object> entry = new LinkedHashMap<>();
        entry.put("name", String.valueOf(parameter.getClass().getMethod("getName").invoke(parameter)));
        entry.put("type", String.valueOf(parameter.getClass().getMethod("getType").invoke(parameter)));
        entry.put("value", String.valueOf(parameter.getClass().getMethod("getValue").invoke(parameter)));
        parameters.add(entry);
      }
      item.put("parameters", parameters);
      contexts.add(item);
    }

    Map<String, Object> result = new LinkedHashMap<>();
    result.put("contexts", contexts);
    return result;
  }

  /**
   * Crea un contexto (un entorno) en el job.
   *
   * El contexto nuevo copia las variables del entorno por defecto, como hace el
   * IDE: un entorno nuevo tiene las mismas variables y se cambian sus valores.
   *
   * @param spec `job` y `name` (el nombre del entorno).
   */
  public static Map<String, Object> createContext(JsonObject spec) throws Exception {
    String name = JsonSpec.required(spec, "name");
    Object editor = TalendApi.designerEditor(spec);
    Object process = TalendApi.processOf(editor);
    Object manager = contextManager(process);

    Object existing = contextNamed(manager, name);
    if (existing != null) {
      throw new IllegalStateException("El job ya tiene un contexto '" + name + "'");
    }

    Class<?> contextClass = TalendClasses.load("org.talend.core.model.context.JobContext");
    Object created = contextClass.getConstructor(String.class).newInstance(name);

    // Se copian las variables del entorno por defecto.
    Object defaultContext = manager.getClass().getMethod("getDefaultContext").invoke(manager);
    if (defaultContext != null) {
      List<Object> copied = new ArrayList<>();
      for (Object parameter : parametersOf(defaultContext)) {
        copied.add(copyOf(parameter));
      }
      created.getClass().getMethod("setContextParameterList", List.class).invoke(created, copied);
    }

    List<Object> contexts = new ArrayList<>(contextsOf(manager));
    contexts.add(created);
    manager.getClass().getMethod("setListContext", List.class).invoke(manager, contexts);

    save(manager, process);

    Map<String, Object> result = new LinkedHashMap<>();
    result.put("name", name);
    result.put("created", true);
    return result;
  }

  /**
   * Crea o cambia una variable de un contexto.
   *
   * @param spec `job`, `context` (el entorno), `name` (la variable), `value`
   *        y `type` opcional (id_String, id_Integer, id_Double, id_Boolean,
   *        id_Date...).
   */
  public static Map<String, Object> setParameter(JsonObject spec) throws Exception {
    String contextName = JsonSpec.required(spec, "context");
    String name = JsonSpec.required(spec, "name");
    String value = JsonSpec.stringOrEmpty(spec, "value");
    String type = JsonSpec.string(spec, "type");

    Object editor = TalendApi.designerEditor(spec);
    Object process = TalendApi.processOf(editor);
    Object manager = contextManager(process);

    Object context = contextNamed(manager, contextName);
    if (context == null) {
      throw new IllegalStateException("El job no tiene el contexto '" + contextName + "'");
    }

    Object parameter = context.getClass().getMethod("getContextParameter", String.class)
        .invoke(context, name);
    boolean created = parameter == null;
    if (created) {
      Class<?> parameterClass = TalendClasses.load("org.talend.core.model.context.JobContextParameter");
      parameter = parameterClass.getConstructor().newInstance();
      parameter.getClass().getMethod("setName", String.class).invoke(parameter, name);
      List<Object> parameters = new ArrayList<>(parametersOf(context));
      parameters.add(parameter);
      context.getClass().getMethod("setContextParameterList", List.class).invoke(context, parameters);
      // La variable nueva se anade tambien a los parametros nuevos del job.
      addNewParameter(manager, name, parameter);
    }
    if (type != null && !type.trim().isEmpty()) {
      parameter.getClass().getMethod("setType", String.class).invoke(parameter, type.trim());
    }
    parameter.getClass().getMethod("setValue", String.class).invoke(parameter, value);
    String comment = JsonSpec.string(spec, "comment");
    if (comment != null) {
      parameter.getClass().getMethod("setComment", String.class).invoke(parameter, comment);
    }

    save(manager, process);

    Map<String, Object> result = new LinkedHashMap<>();
    result.put("context", contextName);
    result.put("name", name);
    result.put("value", value);
    result.put("created", created);
    return result;
  }

  /**
   * Borra una variable de un contexto.
   *
   * @param spec `job`, `context` y `name`.
   */
  public static Map<String, Object> deleteParameter(JsonObject spec) throws Exception {
    String contextName = JsonSpec.required(spec, "context");
    String name = JsonSpec.required(spec, "name");

    Object editor = TalendApi.designerEditor(spec);
    Object process = TalendApi.processOf(editor);
    Object manager = contextManager(process);

    Object context = contextNamed(manager, contextName);
    if (context == null) {
      throw new IllegalStateException("El job no tiene el contexto '" + contextName + "'");
    }
    List<Object> parameters = new ArrayList<>();
    boolean removed = false;
    for (Object parameter : parametersOf(context)) {
      String parameterName = String.valueOf(parameter.getClass().getMethod("getName").invoke(parameter));
      if (parameterName.equals(name)) {
        removed = true;
        continue;
      }
      parameters.add(parameter);
    }
    if (!removed) {
      throw new IllegalStateException("El contexto '" + contextName + "' no tiene la variable '" + name + "'");
    }
    context.getClass().getMethod("setContextParameterList", List.class).invoke(context, parameters);

    save(manager, process);

    Map<String, Object> result = new LinkedHashMap<>();
    result.put("context", contextName);
    result.put("name", name);
    result.put("deleted", true);
    return result;
  }

  /**
   * Borra un contexto del job. El entorno por defecto no se puede borrar.
   *
   * @param spec `job` y `name`.
   */
  public static Map<String, Object> deleteContext(JsonObject spec) throws Exception {
    String name = JsonSpec.required(spec, "name");

    Object editor = TalendApi.designerEditor(spec);
    Object process = TalendApi.processOf(editor);
    Object manager = contextManager(process);

    Object defaultContext = manager.getClass().getMethod("getDefaultContext").invoke(manager);
    if (name.equals(String.valueOf(defaultContext.getClass().getMethod("getName").invoke(defaultContext)))) {
      throw new IllegalStateException("El contexto por defecto no se puede borrar");
    }

    List<Object> contexts = new ArrayList<>();
    boolean removed = false;
    for (Object context : contextsOf(manager)) {
      if (name.equals(String.valueOf(context.getClass().getMethod("getName").invoke(context)))) {
        removed = true;
        continue;
      }
      contexts.add(context);
    }
    if (!removed) {
      throw new IllegalStateException("El job no tiene el contexto '" + name + "'");
    }
    manager.getClass().getMethod("setListContext", List.class).invoke(manager, contexts);

    save(manager, process);

    Map<String, Object> result = new LinkedHashMap<>();
    result.put("name", name);
    result.put("deleted", true);
    return result;
  }

  // ---------------------------------------------------------------------
  // Internos
  // ---------------------------------------------------------------------

  /** El gestor de contextos del proceso. */
  private static Object contextManager(Object process) throws Exception {
    return process.getClass().getMethod("getContextManager").invoke(process);
  }

  /** Los contextos del job. */
  @SuppressWarnings("unchecked")
  private static List<Object> contextsOf(Object manager) throws Exception {
    Object list = manager.getClass().getMethod("getListContext").invoke(manager);
    return list instanceof List ? (List<Object>) list : new ArrayList<>();
  }

  /** Las variables de un contexto. */
  @SuppressWarnings("unchecked")
  private static List<Object> parametersOf(Object context) throws Exception {
    Object list = context.getClass().getMethod("getContextParameterList").invoke(context);
    return list instanceof List ? (List<Object>) list : new ArrayList<>();
  }

  /** El contexto con ese nombre, o null. */
  private static Object contextNamed(Object manager, String name) throws Exception {
    for (Object context : contextsOf(manager)) {
      if (name.equals(String.valueOf(context.getClass().getMethod("getName").invoke(context)))) {
        return context;
      }
    }
    return null;
  }

  /** Una copia de una variable (para copiar las al contexto nuevo). */
  private static Object copyOf(Object parameter) throws Exception {
    Class<?> parameterClass = TalendClasses.load("org.talend.core.model.context.JobContextParameter");
    Object copy = parameterClass.getConstructor().newInstance();
    copy.getClass().getMethod("setName", String.class).invoke(copy,
        parameter.getClass().getMethod("getName").invoke(parameter));
    copy.getClass().getMethod("setType", String.class).invoke(copy,
        parameter.getClass().getMethod("getType").invoke(parameter));
    copy.getClass().getMethod("setValue", String.class).invoke(copy,
        parameter.getClass().getMethod("getValue").invoke(parameter));
    return copy;
  }

  /** Anade la variable a los parametros nuevos del job. */
  private static void addNewParameter(Object manager, String name, Object parameter) {
    try {
      Object map = manager.getClass().getMethod("getNewParametersMap").invoke(manager);
      if (map instanceof java.util.Map) {
        @SuppressWarnings("unchecked")
        java.util.Map<String, Object> typed = (java.util.Map<String, Object>) map;
        typed.put(name, parameter);
      }
    } catch (Exception e) {
      BridgeLog.warn("No se pudo registrar la variable nueva '" + name + "'", e);
    }
  }

  /** Avisa a Studio del cambio y guarda el job. */
  private static void save(Object manager, Object process) throws Exception {
    try {
      manager.getClass().getMethod("setModified", boolean.class).invoke(manager, Boolean.TRUE);
    } catch (Exception e) {
      BridgeLog.warn("No se pudo marcar el gestor de contextos como modificado", e);
    }
    try {
      manager.getClass().getMethod("fireContextsChangedEvent").invoke(manager);
    } catch (Exception e) {
      BridgeLog.warn("No se pudo avisar del cambio de contextos", e);
    }
    TalendApi.markModified(process);
    JobPersistence.persist(process);
  }
}
