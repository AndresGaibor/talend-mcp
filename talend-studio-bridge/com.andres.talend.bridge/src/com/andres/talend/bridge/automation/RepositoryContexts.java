package com.andres.talend.bridge.automation;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import com.andres.talend.bridge.BridgeLog;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import org.eclipse.core.resources.IProject;

/**
 * Contextos del proyecto: los items de tipo "Contexts" del repositorio.
 *
 * Un item de contexto tiene un `.item` (las variables y su tipo) y un
 * `.properties` (los valores por entorno). El MCP los edita con la API de
 * Studio, no escribiendo el XML a mano: asi el IDE mantiene su modelo y el
 * item guardado es el que espera.
 *
 * La API (paquete `org.talend.core.model.properties` y
 * `org.talend.designer.core.model.utils.emf.talendfile`):
 *
 * - `ERepositoryObjectType.CONTEXT`: el tipo de item del repositorio.
 * - `PropertiesFactory.createContextItem()`: el item del repositorio.
 * - `TalendFileFactory.createContextType()`: un entorno (con sus variables).
 * - `TalendFileFactory.createContextParameterType()`: una variable.
 */
public final class RepositoryContexts {

  private RepositoryContexts() {}

  /**
   * Los contextos del proyecto, con sus entornos y sus variables.
   */
  public static Map<String, Object> list(JsonObject spec) throws Exception {
    Object factory = TalendApi.repositoryFactory();
    if (factory == null) {
      throw new IllegalStateException("El repositorio de Talend no esta disponible");
    }
    Object contextType = TalendClasses
        .load("org.talend.core.model.repository.ERepositoryObjectType")
        .getField("CONTEXT").get(null);

    List<Map<String, Object>> contexts = new ArrayList<>();
    for (Object item : itemsOf(factory, contextType)) {
      Map<String, Object> itemInfo = new LinkedHashMap<>();
      Object property = item.getClass().getMethod("getProperty").invoke(item);
      itemInfo.put("name", String.valueOf(property.getClass().getMethod("getLabel").invoke(property)));
      itemInfo.put("version", String.valueOf(property.getClass().getMethod("getVersion").invoke(property)));
      // El contexto por defecto solo lo tienen los items de tipo Contexts.
      Object defaultContext = invokeOrNull(item, "getDefaultContext");
      itemInfo.put("defaultContext", defaultContext == null ? null : String.valueOf(defaultContext));
      itemInfo.put("contexts", contextsOf(item));
      contexts.add(itemInfo);
    }

    Map<String, Object> result = new LinkedHashMap<>();
    result.put("contexts", contexts);
    // La ruta del proyecto: el MCP la usa para leer los entornos y las
    // variables de cada item (la API del repositorio no llega a ellos).
    IProject iProject = TalendApi.resourceProject();
    if (iProject != null && iProject.getLocation() != null) {
      result.put("path", iProject.getLocation().toOSString());
    }
    Object project = TalendApi.currentProject();
    if (project != null) {
      result.put("project", String.valueOf(project.getClass().getMethod("getLabel").invoke(project)));
    }
    return result;
  }

  /**
   * Crea un contexto del proyecto (un item de tipo Contexts) con un entorno y
   * sus variables.
   *
   * @param spec `name` (la etiqueta), `version` opcional, `context` opcional
   *        (el nombre del entorno, "Default" por defecto) y `parameters` (las
   *        variables: name, value y type).
   */
  public static Map<String, Object> create(JsonObject spec) throws Exception {
    try {
      return createItem(spec);
    } catch (RuntimeException e) {
      StackTraceElement[] trace = e.getStackTrace();
      String where = trace.length > 0 ? trace[0].toString() : "sin traza";
      // Sin la causa encadenada: el envoltorio de la operacion muestra solo el
      // mensaje de la causa raiz, y este dice donde fallo.
      throw new IllegalStateException("Fallo creando el contexto en " + where + ": " + e.getMessage());
    }
  }

  private static Map<String, Object> createItem(JsonObject spec) throws Exception {
    String name = JsonSpec.required(spec, "name");
    String version = JsonSpec.string(spec, "version");
    if (version == null || version.trim().isEmpty()) {
      version = "0.1";
    }
    String contextName = JsonSpec.string(spec, "context");
    if (contextName == null || contextName.trim().isEmpty()) {
      contextName = "Default";
    }

    Object project = TalendApi.currentProject();
    if (project == null) {
      throw new IllegalStateException("No hay ningun proyecto de Talend abierto");
    }
    Object repositoryFactory = TalendApi.repositoryFactory();
    if (repositoryFactory == null) {
      throw new IllegalStateException("El repositorio de Talend no esta disponible");
    }

    // Si ya hay un item con esa etiqueta, se borra antes (el repositorio no
    // admite dos items con la misma etiqueta).
    Object existing = findByLabel(repositoryFactory, name);
    if (existing != null) {
      delete(repositoryFactory, project, existing);
    }

    Class<?> propertiesFactory = TalendClasses.load("org.talend.core.model.properties.PropertiesFactory");
    Object properties = propertiesFactory.getField("eINSTANCE").get(null);
    Object property = propertiesFactory.getMethod("createProperty").invoke(properties);
    property.getClass().getMethod("setId", String.class).invoke(property, JobRepository.generateId());
    property.getClass().getMethod("setLabel", String.class).invoke(property, name);
    property.getClass().getMethod("setDisplayName", String.class).invoke(property, name);
    property.getClass().getMethod("setVersion", String.class).invoke(property, version);

    Object item = propertiesFactory.getMethod("createContextItem").invoke(properties);
    item.getClass().getMethod("setProperty",
        TalendClasses.load("org.talend.core.model.properties.Property")).invoke(item, property);
    Object state = propertiesFactory.getMethod("createItemState").invoke(properties);
    item.getClass().getMethod("setState",
        TalendClasses.load("org.talend.core.model.properties.ItemState")).invoke(item, state);
    item.getClass().getMethod("setDefaultContext", String.class).invoke(item, contextName);

    // El entorno va dentro del recurso del item. Y sus variables se anaden
    // despues: un ContextType que no esta en un recurso no admite cambios en
    // su contencion.
    Object xmiResourceManager = TalendApi.xmiResourceManager();
    IProject iProject = TalendApi.resourceProject();
    Class<?> repositoryType = TalendClasses.load("org.talend.core.model.repository.ERepositoryObjectType");
    Object repositoryObjectType = repositoryType.getField("CONTEXT").get(null);
    Object itemResource = xmiResourceManager.getClass()
        .getMethod("createItemResource", TalendClasses.load("org.eclipse.core.resources.IProject"),
            TalendClasses.load("org.talend.core.model.properties.Item"),
            org.eclipse.core.runtime.IPath.class, repositoryType, boolean.class)
        .invoke(xmiResourceManager, iProject, item, org.eclipse.core.runtime.Path.fromOSString("context")
            .append(name + "_" + version), repositoryObjectType, false);

    Object contextType = TalendClasses
        .load("org.talend.designer.core.model.utils.emf.talendfile.TalendFileFactory")
        .getField("eINSTANCE").get(null);
    Object created = contextType.getClass().getMethod("createContextType").invoke(contextType);
    created.getClass().getMethod("setName", String.class).invoke(created, contextName);

    @SuppressWarnings("unchecked")
    List<Object> contents = (List<Object>) itemResource.getClass()
        .getMethod("getContents").invoke(itemResource);
    contents.add(created);

    for (JsonObject parameter : parametersOf(spec)) {
      addParameter(created, parameter);
    }

    // Las referencias a los entornos las crea el repositorio al registrar el
    // item: la lista de referencias del item no admite cambios antes de
    // que este guardado.
    repositoryFactory.getClass()
        .getMethod("create", TalendClasses.load("org.talend.core.model.general.Project"),
            TalendClasses.load("org.talend.core.model.properties.Item"),
            org.eclipse.core.runtime.IPath.class, boolean[].class)
        .invoke(repositoryFactory, project, item,
            org.eclipse.core.runtime.Path.fromOSString(name), new boolean[0]);

    // Ya registrado, el item admite cambios: se le engancha el entorno y se
    // guarda.
    boolean attached = attachEnvironment(repositoryFactory, item, created);
    if (!attached) {
      // Si el entorno no se ha podido enganchar, el item se queda vacio: es
      // mejor borrarlo que dejar un contexto sin variables en el proyecto.
      delete(repositoryFactory, project, item);
      throw new IllegalStateException(
          "Studio no ha permitido enganchar el entorno al item del contexto: "
              + "crear contextos del proyecto con la API no esta soportado todavia");
    }

    Map<String, Object> result = new LinkedHashMap<>();
    result.put("name", name);
    result.put("version", version);
    result.put("context", contextName);
    result.put("created", true);
    return result;
  }

  /**
   * Engancha el entorno al item del contexto y lo guarda.
   *
   * El entorno cuelga del item por una referencia (`<context href="..."/>` en el
   * `.properties`), y esa lista solo admite cambios cuando el item ya esta
   * guardado.
   *
   * @return si el entorno quedo enganchado.
   */
  private static boolean attachEnvironment(Object factory, Object item, Object environment) {
    try {
      Object contextItem = contextItemOf(item);
      if (contextItem == null) {
        return false;
      }
      Object references = invokeOrNull(contextItem, "getContext");
      if (!(references instanceof List)) {
        return false;
      }
      @SuppressWarnings("unchecked")
      List<Object> lista = (List<Object>) references;
      // El tipo de la referencia: la caracteristica "context" del item.
      Object eClass = contextItem.getClass().getMethod("eClass").invoke(contextItem);
      java.lang.reflect.Method getter = null;
      for (java.lang.reflect.Method method : eClass.getClass().getMethods()) {
        if ("getEStructuralFeature".equals(method.getName()) && method.getParameterCount() == 1
            && method.getParameterTypes()[0] == String.class) {
          getter = method;
          break;
        }
      }
      if (getter == null) {
        return false;
      }
      Object feature = getter.invoke(eClass, "context");
      Object type = feature.getClass().getMethod("getEType").invoke(feature);
      String className = String.valueOf(type.getClass().getMethod("getInstanceClassName").invoke(type));
      Class<?> referenceClass = TalendClasses.load(className);
      Object reference = referenceClass.getConstructor().newInstance();
      for (java.lang.reflect.Method method : referenceClass.getMethods()) {
        if (method.getParameterCount() != 1) {
          continue;
        }
        String name = method.getName().toLowerCase();
        if (name.startsWith("set") && (name.contains("context") || name.contains("href"))) {
          if (method.getParameterTypes()[0].isInstance(environment)) {
            method.invoke(reference, environment);
            break;
          }
        }
      }
      lista.add(reference);
      save(factory, item);
      return true;
    } catch (Exception e) {
      BridgeLog.warn("No se pudo enganchar el entorno al item del contexto", e);
      return false;
    }
  }

  /**
   * Crea o cambia una variable de un entorno de un contexto del proyecto.
   *
   * @param spec `name` (la etiqueta del contexto), `context` (el entorno),
   *        `parameter` (la variable), `value` y `type` opcional.
   */
  public static Map<String, Object> setParameter(JsonObject spec) throws Exception {
    String name = JsonSpec.required(spec, "name");
    String contextName = JsonSpec.required(spec, "context");
    String parameterName = JsonSpec.required(spec, "parameter");
    String value = JsonSpec.stringOrEmpty(spec, "value");
    String type = JsonSpec.string(spec, "type");

    Object factory = TalendApi.repositoryFactory();
    Object item = findByLabel(factory, name);
    if (item == null) {
      throw new IllegalStateException("El proyecto no tiene el contexto '" + name + "'");
    }
    Object environment = environmentOf(item, contextName);
    if (environment == null) {
      throw new IllegalStateException("El contexto '" + name + "' no tiene el entorno '" + contextName + "'");
    }

    Object parameter = parameterOf(environment, parameterName);
    boolean created = parameter == null;
    if (created) {
      Class<?> parameterClass = TalendClasses
          .load("org.talend.designer.core.model.utils.emf.talendfile.TalendFileFactory");
      Object factoryInstance = parameterClass.getField("eINSTANCE").get(null);
      parameter = factoryInstance.getClass().getMethod("createContextParameterType").invoke(factoryInstance);
      parameter.getClass().getMethod("setName", String.class).invoke(parameter, parameterName);
      List<Object> lista = parametersListOf(environment);
      if (lista == null) {
        throw new IllegalStateException("El entorno del contexto no admite variables nuevas");
      }
      lista.add(parameter);
    }
    if (type != null && !type.trim().isEmpty()) {
      parameter.getClass().getMethod("setType", String.class).invoke(parameter, type.trim());
    }
    parameter.getClass().getMethod("setValue", String.class).invoke(parameter, value);

    save(factory, item);

    Map<String, Object> result = new LinkedHashMap<>();
    result.put("name", name);
    result.put("context", contextName);
    result.put("parameter", parameterName);
    result.put("value", value);
    result.put("created", created);
    return result;
  }

  /**
   * Borra una variable de un entorno de un contexto del proyecto.
   */
  public static Map<String, Object> deleteParameter(JsonObject spec) throws Exception {
    String name = JsonSpec.required(spec, "name");
    String contextName = JsonSpec.required(spec, "context");
    String parameterName = JsonSpec.required(spec, "parameter");

    Object factory = TalendApi.repositoryFactory();
    Object item = findByLabel(factory, name);
    if (item == null) {
      throw new IllegalStateException("El proyecto no tiene el contexto '" + name + "'");
    }
    Object environment = environmentOf(item, contextName);
    if (environment == null) {
      throw new IllegalStateException("El contexto '" + name + "' no tiene el entorno '" + contextName + "'");
    }
    Object parameter = parameterOf(environment, parameterName);
    if (parameter == null) {
      throw new IllegalStateException(
          "El entorno '" + contextName + "' no tiene la variable '" + parameterName + "'");
    }
    Object contents = environment.getClass().getMethod("eContents").invoke(environment);
    List<Object> lista = parametersListOf(environment);
    if (lista == null) {
      throw new IllegalStateException("El entorno del contexto no admite variables nuevas");
    }
    lista.remove(parameter);

    save(factory, item);

    Map<String, Object> result = new LinkedHashMap<>();
    result.put("name", name);
    result.put("context", contextName);
    result.put("parameter", parameterName);
    result.put("deleted", true);
    return result;
  }

  /**
   * Borra un contexto del proyecto.
   */
  public static Map<String, Object> delete(JsonObject spec) throws Exception {
    String name = JsonSpec.required(spec, "name");
    Object project = TalendApi.currentProject();
    Object factory = TalendApi.repositoryFactory();
    Object item = findByLabel(factory, name);
    if (item == null) {
      throw new IllegalStateException("El proyecto no tiene el contexto '" + name + "'");
    }
    String version = String.valueOf(item.getClass().getMethod("getProperty").invoke(item)
        .getClass().getMethod("getVersion").invoke(item.getClass().getMethod("getProperty").invoke(item)));
    delete(factory, project, item);
    // Ademas del item, se borran los archivos que dejo en la carpeta
    // `context` del proyecto: si no, quedan sueltos y el IDE los vuelve a
    // leer.
    boolean filesRemoved = deleteFiles(name, version);

    Map<String, Object> result = new LinkedHashMap<>();
    result.put("name", name);
    result.put("filesRemoved", filesRemoved);
    result.put("deleted", true);
    return result;
  }

  /** Borra los archivos del contexto en la carpeta `context` del proyecto. */
  private static boolean deleteFiles(String name, String version) {
    try {
      IProject iProject = TalendApi.resourceProject();
      if (iProject == null) {
        return false;
      }
      org.eclipse.core.resources.IFolder root = iProject.getFolder("context");
      if (!root.exists()) {
        return false;
      }
      boolean removed = false;
      org.eclipse.core.resources.IFolder folder = root.getFolder(name);
      if (folder.exists()) {
        folder.delete(true, true, null);
        removed = true;
      }
      for (String extension : new String[] {".item", ".properties", ".screenshot"}) {
        org.eclipse.core.resources.IFile file = root.getFile(name + "_" + version + extension);
        if (file.exists()) {
          file.delete(true, null);
          removed = true;
        }
      }
      return removed;
    } catch (Exception e) {
      BridgeLog.warn("No se pudieron borrar los archivos del contexto '" + name + "'", e);
      return false;
    }
  }

  // ---------------------------------------------------------------------
  // Internos
  // ---------------------------------------------------------------------

  /** Llama a un metodo que puede no existir en el tipo concreto. */
  private static Object invokeOrNull(Object target, String method) {
    try {
      return target.getClass().getMethod(method).invoke(target);
    } catch (Exception e) {
      return null;
    }
  }

  /** Los items de un tipo del repositorio. */
  private static List<Object> itemsOf(Object factory, Object type) throws Exception {
    List<Object> items = new ArrayList<>();
    for (java.lang.reflect.Method method : factory.getClass().getMethods()) {
      if (!"getAll".equals(method.getName()) || method.getParameterTypes().length != 1) {
        continue;
      }
      if (!method.getParameterTypes()[0].getName()
          .equals("org.talend.core.model.repository.ERepositoryObjectType")) {
        continue;
      }
      Object all = method.invoke(factory, type);
      if (all instanceof Iterable) {
        for (Object item : (Iterable<?>) all) {
          items.add(item);
        }
      }
      break;
    }
    return items;
  }

  /** El item del repositorio con esa etiqueta. */
  private static Object findByLabel(Object factory, String name) throws Exception {
    Class<?> enumClass = TalendClasses.load("org.talend.core.model.repository.ERepositoryObjectType");
    Object type = enumClass.getField("CONTEXT").get(null);
    for (Object item : itemsOf(factory, type)) {
      Object property = item.getClass().getMethod("getProperty").invoke(item);
      Object label = property.getClass().getMethod("getLabel").invoke(property);
      if (name.equals(String.valueOf(label))) {
        return item;
      }
    }
    return null;
  }

  /** Los entornos de un item de contexto, con sus variables. */
  private static List<Map<String, Object>> contextsOf(Object item) throws Exception {
    List<Map<String, Object>> contexts = new ArrayList<>();
    for (Object environment : environmentsOf(item)) {
      Map<String, Object> entry = new LinkedHashMap<>();
      entry.put("name", String.valueOf(environment.getClass().getMethod("getName").invoke(environment)));
      List<Map<String, Object>> parameters = new ArrayList<>();
      for (Object parameter : parametersIn(environment)) {
        Map<String, Object> item2 = new LinkedHashMap<>();
        item2.put("name", String.valueOf(parameter.getClass().getMethod("getName").invoke(parameter)));
        item2.put("type", String.valueOf(parameter.getClass().getMethod("getType").invoke(parameter)));
        item2.put("value", String.valueOf(parameter.getClass().getMethod("getValue").invoke(parameter)));
        parameters.add(item2);
      }
      entry.put("parameters", parameters);
      contexts.add(entry);
    }
    return contexts;
  }

  /** Los entornos (los ContextType) de un item de contexto. */
  private static List<Object> environmentsOf(Object item) throws Exception {
    List<Object> environments = new ArrayList<>();
    // Los entornos cuelgan del item de tipo Contexts, que es el "item" de la
    // propiedad del objeto del repositorio.
    Object contextItem = contextItemOf(item);
    if (contextItem == null) {
      return environments;
    }
    Object references = invokeOrNull(contextItem, "getContext");
    if (references instanceof Iterable) {
      for (Object reference : (Iterable<?>) references) {
        Object environment = invokeOrNull(reference, "getContext");
        if (environment != null) {
          environments.add(environment);
        }
      }
    }
    return environments;
  }

  /** El item de tipo Contexts que hay detras de un objeto del repositorio. */
  private static Object contextItemOf(Object item) {
    try {
      Object property = item.getClass().getMethod("getProperty").invoke(item);
      if (property == null) {
        return null;
      }
      return invokeOrNull(property, "getItem");
    } catch (Exception e) {
      return null;
    }
  }

  /** El entorno con ese nombre, o null. */
  private static Object environmentOf(Object item, String name) throws Exception {
    for (Object environment : environmentsOf(item)) {
      if (name.equals(String.valueOf(environment.getClass().getMethod("getName").invoke(environment)))) {
        return environment;
      }
    }
    return null;
  }

  /** Las variables de un entorno. */
  private static List<Object> parametersIn(Object environment) throws Exception {
    List<Object> parameters = new ArrayList<>();
    List<Object> lista = parametersListOf(environment);
    if (lista == null) {
      return parameters;
    }
    for (Object content : lista) {
      try {
        content.getClass().getMethod("getName");
        content.getClass().getMethod("getValue");
        parameters.add(content);
      } catch (Exception e) {
        // No es una variable.
      }
    }
    return parameters;
  }

  /** La variable con ese nombre, o null. */
  private static Object parameterOf(Object environment, String name) throws Exception {
    for (Object parameter : parametersIn(environment)) {
      if (name.equals(String.valueOf(parameter.getClass().getMethod("getName").invoke(parameter)))) {
        return parameter;
      }
    }
    return null;
  }

  /** Anade una variable a un entorno. */
  private static void addParameter(Object environment, JsonObject parameter) throws Exception {
    Class<?> factoryClass = TalendClasses
        .load("org.talend.designer.core.model.utils.emf.talendfile.TalendFileFactory");
    Object factory = factoryClass.getField("eINSTANCE").get(null);
    Object created = factory.getClass().getMethod("createContextParameterType").invoke(factory);
    created.getClass().getMethod("setName", String.class).invoke(created,
        JsonSpec.stringOrEmpty(parameter, "name"));
    String type = JsonSpec.string(parameter, "type");
    if (type != null && !type.trim().isEmpty()) {
      created.getClass().getMethod("setType", String.class).invoke(created, type.trim());
    }
    created.getClass().getMethod("setValue", String.class).invoke(created,
        JsonSpec.stringOrEmpty(parameter, "value"));

    List<Object> lista = parametersListOf(environment);
    if (lista == null) {
      throw new IllegalStateException("El entorno del contexto no admite variables nuevas");
    }
    try {
      lista.add(created);
    } catch (UnsupportedOperationException e) {
      throw new IllegalStateException(
          "El entorno del contexto no admite variables nuevas todavia (no esta guardado)");
    }
  }

  /**
   * La lista de variables de un entorno.
   *
   * Las variables cuelgan de una caracteristica del modelo (`contextParameter`),
   * no de la contencion: por eso hay que buscarla con `eGet`.
   */
  @SuppressWarnings("unchecked")
  private static List<Object> parametersListOf(Object environment) throws Exception {
    Object eClass = environment.getClass().getMethod("eClass").invoke(environment);
    java.lang.reflect.Method getter = null;
    for (java.lang.reflect.Method method : eClass.getClass().getMethods()) {
      if ("getEStructuralFeature".equals(method.getName()) && method.getParameterCount() == 1
          && method.getParameterTypes()[0] == String.class) {
        getter = method;
        break;
      }
    }
    if (getter != null) {
      Object feature = getter.invoke(eClass, "contextParameter");
      if (feature != null) {
        // El metodo se busca por el tipo de su argumento: `eGet` tiene
        // sobrecargas (por indice y por caracteristica) y hay que elegir la
        // que acepta la caracteristica.
        for (java.lang.reflect.Method method : environment.getClass().getMethods()) {
          if ("eGet".equals(method.getName()) && method.getParameterCount() == 1
              && method.getParameterTypes()[0].isInstance(feature)) {
            Object list = method.invoke(environment, feature);
            if (list instanceof List) {
              return (List<Object>) list;
            }
            break;
          }
        }
      }
    }
    Object contents = environment.getClass().getMethod("eContents").invoke(environment);
    return contents instanceof List ? (List<Object>) contents : null;
  }

  /** Las variables que pide el spec, como objetos JSON. */
  private static List<JsonObject> parametersOf(JsonObject spec) {
    List<JsonObject> parameters = new ArrayList<>();
    Object raw = spec.get("parameters");
    if (raw instanceof com.google.gson.JsonArray) {
      for (JsonElement element : ((com.google.gson.JsonArray) raw)) {
        if (element.isJsonObject()) {
          parameters.add(element.getAsJsonObject());
        }
      }
    }
    return parameters;
  }

  /** Guarda el item del repositorio. */
  private static void save(Object factory, Object item) {
    try {
      factory.getClass().getMethod("save", Object.class).invoke(factory, item);
    } catch (Exception e) {
      BridgeLog.warn("No se pudo guardar el item del repositorio", e);
    }
  }

  /** Borra un item del repositorio. */
  private static void delete(Object factory, Object project, Object item) {
    try {
      factory.getClass().getMethod("delete", Object.class, Object.class).invoke(factory, project, item);
    } catch (Exception e) {
      BridgeLog.warn("No se pudo borrar el item del repositorio", e);
    }
  }
}
