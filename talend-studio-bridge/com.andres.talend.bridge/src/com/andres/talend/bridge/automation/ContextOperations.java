package com.andres.talend.bridge.automation;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

/** Agrega variables al contexto por defecto mediante el modelo de Studio. */
public final class ContextOperations {

  private static final Set<String> TYPES = new HashSet<String>();

  static {
    String[] types = { "id_Boolean", "id_Character", "id_Date", "id_Double", "id_Float",
        "id_Integer", "id_Long", "id_Short", "id_String", "id_BigDecimal", "id_File",
        "id_Directory", "id_Password" };
    for (String type : types) TYPES.add(type);
  }

  private ContextOperations() {}

  public static Map<String, Object> addParameters(JsonObject spec) throws Exception {
    return com.andres.talend.bridge.UiThread.sync(() -> addParametersOnUi(spec));
  }

  @SuppressWarnings("unchecked")
  private static Map<String, Object> addParametersOnUi(JsonObject spec) throws Exception {
    Object editor = TalendApi.designerEditor(spec);
    Object process = TalendApi.processOf(editor);
    Object manager = process.getClass().getMethod("getContextManager").invoke(process);
    Object context = manager.getClass().getMethod("getDefaultContext").invoke(manager);
    if (context == null) throw new IllegalStateException("El Job no tiene un contexto por defecto");
    List<Object> parameters = new ArrayList<>((List<Object>) context.getClass()
        .getMethod("getContextParameterList").invoke(context));
    JsonArray requested = spec.getAsJsonArray("contexts");
    if (requested == null) throw new IllegalArgumentException("Falta la lista 'contexts'");

    Map<String, Object> parametersByName = new HashMap<String, Object>();
    for (Object parameter : parameters) {
      String existingName = String.valueOf(parameter.getClass().getMethod("getName").invoke(parameter));
      parametersByName.put(existingName, parameter);
    }

    // Valida toda la solicitud antes de tocar el gestor de contextos.
    List<JsonObject> toAdd = new ArrayList<>();
    Set<String> requestedNames = new HashSet<>();
    for (JsonElement element : requested) {
      if (element == null || !element.isJsonObject()) {
        throw new IllegalArgumentException("Cada variable de contexto debe ser un objeto");
      }
      JsonObject input = element.getAsJsonObject();
      String name = required(input, "name");
      String type = required(input, "type");
      String value = required(input, "value");
      if (!name.matches("[A-Za-z_][A-Za-z0-9_]*")) {
        throw new IllegalArgumentException("Nombre de contexto no válido: " + name);
      }
      if (!TYPES.contains(type)) throw new IllegalArgumentException("Tipo de contexto no válido: " + type);
      if (!requestedNames.add(name)) {
        throw new IllegalArgumentException("La solicitud repite la variable de contexto '" + name + "'");
      }

      Object existing = parametersByName.get(name);
      if (existing != null) {
        String oldType = String.valueOf(existing.getClass().getMethod("getType").invoke(existing));
        String oldValue = String.valueOf(existing.getClass().getMethod("getValue").invoke(existing));
        if (!type.equals(oldType) || !value.equals(oldValue)) {
          throw new IllegalStateException("La variable de contexto '" + name + "' ya existe con otro valor o tipo");
        }
      } else {
        toAdd.add(input);
      }
    }

    List<String> namesToRemove = new ArrayList<>();
    JsonArray requestedRemovals = spec.getAsJsonArray("removeManagedTodoNames");
    if (requestedRemovals != null) {
      for (JsonElement element : requestedRemovals) {
        if (element == null || element.isJsonNull()) continue;
        String name = element.getAsString();
        if (!name.startsWith("migration_todo_")) {
          throw new IllegalArgumentException("Solo se pueden reemplazar variables migration_todo_* creadas por el portal");
        }
        if (requestedNames.contains(name)) {
          throw new IllegalArgumentException("No se puede crear y retirar la misma variable de contexto: " + name);
        }
        namesToRemove.add(name);
      }
    }

    int added = 0;
    for (JsonObject input : toAdd) {
      String name = required(input, "name");
      String type = required(input, "type");
      String value = required(input, "value");

      Class<?> parameterClass = TalendClasses.load("org.talend.core.model.context.JobContextParameter");
      Object parameter = parameterClass.getConstructor().newInstance();
      parameterClass.getMethod("setName", String.class).invoke(parameter, name);
      parameterClass.getMethod("setType", String.class).invoke(parameter, type);
      parameterClass.getMethod("setValue", String.class).invoke(parameter, value);
      String comment = input.has("comment") && !input.get("comment").isJsonNull()
          ? input.get("comment").getAsString() : "Importado desde la guía SAS";
      parameterClass.getMethod("setComment", String.class).invoke(parameter, comment);
      parameters.add(parameter);
      parametersByName.put(name, parameter);
      JobContexts.addNewParameter(manager, name, parameter);
      added++;
    }

    int removed = 0;
    for (String name : namesToRemove) {
      Object existing = parametersByName.get(name);
      if (existing == null) continue;
      String value = String.valueOf(existing.getClass().getMethod("getValue").invoke(existing));
      Object commentValue = existing.getClass().getMethod("getComment").invoke(existing);
      String comment = commentValue == null ? "" : String.valueOf(commentValue);
      if (!value.trim().isEmpty() || !comment.startsWith("Información técnica pendiente del portal")) continue;
      if (parameters.remove(existing)) {
        parametersByName.remove(name);
        JobContexts.removeNewParameter(manager, name);
        removed++;
      }
    }

    context.getClass().getMethod("setContextParameterList", List.class).invoke(context, parameters);
    JobContexts.save(manager, process);
    Map<String, Object> result = new java.util.LinkedHashMap<String, Object>();
    result.put("added", added);
    result.put("removed", removed);
    result.put("total", parameters.size());
    result.put("saved", true);
    return result;
  }

  private static String required(JsonObject input, String key) {
    JsonElement value = input.get(key);
    if (value == null || value.isJsonNull()) throw new IllegalArgumentException("Falta '" + key + "'");
    return value.getAsString();
  }
}
