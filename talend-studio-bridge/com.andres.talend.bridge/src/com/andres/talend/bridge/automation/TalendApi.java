package com.andres.talend.bridge.automation;

import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

import com.andres.talend.bridge.BridgeLog;
import com.andres.talend.bridge.workbench.WorkbenchService;

import com.google.gson.JsonObject;

import org.eclipse.core.resources.IProject;
import org.eclipse.ui.IEditorPart;

/**
 * Acceso a las APIs de Talend por reflexion.
 *
 * Todo se hace por reflexion a proposito: el plugin se instala junto a
 * distintas versiones de Studio y atarlo a las clases de Talend haria que no
 * cargara en ninguna.
 *
 * Aqui vive el "donde esta cada cosa": el editor abierto, el proceso del
 * job, el nodo por su nombre unico, el componente del catalogo.
 */
public final class TalendApi {

  private TalendApi() {}

  // ---------------------------------------------------------------------
  // El IDE
  // ---------------------------------------------------------------------

  /**
   * Editor grafico del job abierto.
   *
   * Si el spec dice que job es, se opera sobre ese, no sobre el que este
   * activo: con varios jobs abiertos en Studio, operar sobre el activo
   * modificaria el job equivocado.
   */
  public static Object designerEditor(JsonObject spec) throws Exception {
    String jobName = JsonSpec.string(spec, "job");
    if (jobName != null && !jobName.trim().isEmpty()) {
      IEditorPart editor = editorOfJob(jobName);
      if (editor == null) {
        JsonObject jobSpec = new JsonObject();
        jobSpec.addProperty("name", jobName);
        String version = JsonSpec.string(spec, "version");
        if (version != null) {
          jobSpec.addProperty("version", version);
        }
        JobOperationsService.openJob(jobSpec);
        editor = editorOfJob(jobName);
      }
      if (editor == null) {
        throw new IllegalStateException("No se pudo abrir el job '" + jobName + "' en el editor");
      }
      return designerOf(editor);
    }

    IEditorPart editor = WorkbenchService.activeEditorPart();
    if (editor == null) {
      throw new IllegalStateException(
          "No hay ningun job abierto: indica 'job' en la peticion");
    }
    return designerOf(editor);
  }

  /**
   * Editor abierto de un job, por su nombre.
   *
   * Se devuelve el primero que hay. Los duplicados no se cierran aqui: al
   * cerrarlos se descarta el proceso del editor, y con el se van los nodos
   * que se hubieron anadido y no estaban en el disco.
   */
  public static IEditorPart editorOfJob(String jobName) {
    org.eclipse.ui.IWorkbenchPage page = WorkbenchService.activePageOrNull();
    if (page == null) {
      return null;
    }
    IEditorPart found = null;
    for (org.eclipse.ui.IEditorReference reference : page.getEditorReferences()) {
      if (!isEditorOfJob(reference.getTitle(), jobName)) {
        continue;
      }
      try {
        IEditorPart editor = reference.getEditor(true);
        if (editor != null && found == null) {
          found = editor;
        }
      } catch (Exception e) {
        // El editor no se puede abrir: se sigue con el siguiente.
      }
    }
    if (found != null) {
      try {
        page.activate(found);
      } catch (Exception e) {
        // Si no se puede activar, se sigue con el que hay.
      }
    }
    return found;
  }

  /**
   * Si el titulo de un editor es el de ese job ("Job MCP_X 0.1", con un
   * asterisco delante cuando tiene cambios sin guardar).
   *
   * Coincidencia exacta del nombre: con "contains", MCP_Fase1 casaba tambien
   * con MCP_Fase10 y las operaciones acababan en el job equivocado.
   */
  static boolean isEditorOfJob(String title, String jobName) {
    if (title == null) {
      return false;
    }
    String clean = title.startsWith("*") ? title.substring(1) : title;
    String prefix = "Job " + jobName;
    return clean.equals(prefix) || clean.startsWith(prefix + " ");
  }

  /**
   * Cierra, sin guardar, todos los editores de un job.
   *
   * Hay que hacerlo al borrar el job: el editor sigue abierto con el modelo
   * del job que ya no existe, y al recrearlo con el mismo nombre las
   * operaciones podian caer en ese editor obsoleto.
   *
   * @return cuantos editores se cerraron.
   */
  public static int closeEditorsOfJob(String jobName) {
    org.eclipse.ui.IWorkbenchPage page = WorkbenchService.activePageOrNull();
    if (page == null) {
      return 0;
    }
    int closed = 0;
    for (org.eclipse.ui.IEditorReference reference : page.getEditorReferences()) {
      if (!isEditorOfJob(reference.getTitle(), jobName)) {
        continue;
      }
      try {
        IEditorPart editor = reference.getEditor(false);
        if (editor != null && page.closeEditor(editor, false)) {
          closed++;
        }
      } catch (Exception e) {
        // Si un editor no se deja cerrar, se sigue con los demas.
      }
    }
    return closed;
  }

  /** Job de trabajo que se abre cuando hace falta un proceso y no hay ninguno. */
  public static final String SCRATCH_JOB = "MCP_Scratch";

  /**
   * Un proceso (job) con el que construir nodos sueltos.
   *
   * Leer los parametros de un componente exige crear un Node, y su
   * constructor le pide al proceso un nombre unico: sin proceso da NPE. Se usa
   * el del job que esta activo y, si no hay ninguno, el job de trabajo (que se
   * crea la primera vez). El nodo no se anade al job, asi que no lo modifica.
   */
  public static Object processForIntrospection() throws Exception {
    IEditorPart active = WorkbenchService.activeEditorPart();
    if (active != null && invokeOrNull(active, "getDesignerEditor") != null) {
      return processOf(designerOf(active));
    }
    JsonObject spec = new JsonObject();
    spec.addProperty("job", SCRATCH_JOB);
    try {
      return processOf(designerEditor(spec));
    } catch (IllegalStateException e) {
      JsonObject create = new JsonObject();
      create.addProperty("name", SCRATCH_JOB);
      create.addProperty("replace", true);
      JobRepository.create(create);
      return processOf(designerEditor(spec));
    }
  }

  /** Editor grafico (el lienzo) de un editor de job. */
  private static Object designerOf(IEditorPart editor) throws Exception {
    Object designer = editor.getClass().getMethod("getDesignerEditor").invoke(editor);
    return designer != null ? designer : editor;
  }

  /** Proceso (job) abierto en el editor. */
  public static Object processOf(Object editor) throws Exception {
    Object process = editor.getClass().getMethod("getProcess").invoke(editor);
    if (process == null) {
      throw new IllegalStateException("El editor no tiene un proceso cargado");
    }
    return process;
  }

  // ---------------------------------------------------------------------
  // El proyecto
  // ---------------------------------------------------------------------

  /** Proyecto de Talend abierto. */
  public static Object currentProject() throws Exception {
    Class<?> projectManagerClass = TalendClasses.load("org.talend.repository.ProjectManager");
    Object projectManager = projectManagerClass.getMethod("getInstance").invoke(null);
    return projectManagerClass.getMethod("getCurrentProject").invoke(projectManager);
  }

  /** Proyecto de Eclipse que corresponde al proyecto de Talend abierto. */
  public static IProject resourceProject() throws Exception {
    Class<?> projectManagerClass = TalendClasses.load("org.talend.repository.ProjectManager");
    Object projectManager = projectManagerClass.getMethod("getInstance").invoke(null);
    Object project = projectManagerClass.getMethod("getCurrentProject").invoke(projectManager);
    Object emfProject = project.getClass().getMethod("getEmfProject").invoke(project);
    return (IProject) projectManagerClass
        .getMethod("getResourceProject", TalendClasses.load("org.talend.core.model.properties.Project"))
        .invoke(projectManager, emfProject);
  }

  /** Repositorio de Talend del proyecto abierto. */
  public static Object repositoryFactory() throws Exception {
    Object plugin = TalendClasses.load("org.talend.core.runtime.CoreRuntimePlugin")
        .getMethod("getInstance").invoke(null);
    return plugin.getClass().getMethod("getProxyRepositoryFactory").invoke(plugin);
  }

  /** `XmiResourceManager` de Talend, por donde se crean los recursos EMF. */
  public static Object xmiResourceManager() throws Exception {
    Class<?> proxyFactoryClass = TalendClasses.load("org.talend.core.repository.model.ProxyRepositoryFactory");
    Object proxyFactory = proxyFactoryClass.getMethod("getInstance").invoke(null);
    return proxyFactoryClass.getMethod("getXmiResourceManager").invoke(proxyFactory);
  }

  // ---------------------------------------------------------------------
  // El modelo
  // ---------------------------------------------------------------------

  /**
   * Componente del catalogo por su nombre.
   *
   * El catalogo lo publica Talend con `IComponentsService`.
   */
  public static Object findCatalogComponent(String componentName) throws Exception {
    return findCatalogComponent(componentName, DEFAULT_PALETTE);
  }

  /** Variante del catalogo que se usa en un job Standard. */
  public static final String DEFAULT_PALETTE = "DI";

  /**
   * Componente del catalogo por nombre y tipo de job.
   *
   * El mismo nombre existe en varias variantes (Standard, Spark Batch, Spark
   * Streaming...) con parametros distintos; devolver "la primera" daba a veces
   * la de Spark. Si no hay variante de ese tipo, cae a la primera que case.
   */
  public static Object findCatalogComponent(String componentName, String paletteType) throws Exception {
    Class<?> serviceClass = TalendClasses.load("org.talend.core.model.components.IComponentsService");
    Object service = serviceClass.getMethod("get").invoke(null);
    Object factory = service.getClass().getMethod("getComponentsFactory").invoke(service);
    Object components = factory.getClass().getMethod("getComponents").invoke(factory);
    Object fallback = null;
    if (components instanceof Set) {
      for (Object candidate : (Set<?>) components) {
        Object name = candidate.getClass().getMethod("getName").invoke(candidate);
        if (!componentName.equals(name)) {
          continue;
        }
        Object palette = invokeOrNull(candidate, "getPaletteType");
        if (paletteType != null && paletteType.equalsIgnoreCase(String.valueOf(palette))) {
          return candidate;
        }
        if (fallback == null) {
          fallback = candidate;
        }
      }
    }
    return fallback;
  }

  /**
   * Marca el proceso como modificado.
   *
   * Sin esto el editor no se considera dirty y el guardado no escribe nada:
   * cambiar un parametro no dispara por si solo el aviso de cambio.
   */
  public static void markModified(Object process) {
    try {
      process.getClass().getMethod("setProcessModified", boolean.class).invoke(process, Boolean.TRUE);
    } catch (Exception e) {
      BridgeLog.warn("No se pudo marcar el proceso como modificado", e);
    }
  }

  // ---------------------------------------------------------------------
  // Utilidades
  // ---------------------------------------------------------------------

  /**
   * Nodo del proceso por su unique name.
   *
   * Se usa el metodo oficial de Talend (`Process.getNodeByUniqueName`) porque
   * `getGraphicalNodes` no incluye los nodos de conexion (el tDBConnection,
   * el tFTPConnection...), que si estan en el job pero no en el lienzo.
   */
  public static Object nodeByUniqueName(Object process, String uniqueName) throws Exception {
    Object found = invokeOrNull(process, "getNodeByUniqueName");
    if (found != null) {
      // El metodo oficial devuelve el nodo, pero hay que comprobar que es
      // el pedido (puede devolver null).
      Object name = invokeOrNull(found, "getUniqueName");
      if (name != null && uniqueName.equals(name)) {
        return found;
      }
    }
    Object nodes = invokeOrNull(process, "getGraphicalNodes");
    if (nodes instanceof Iterable) {
      for (Object node : (Iterable<?>) nodes) {
        Object name = invokeOrNull(node, "getUniqueName");
        if (uniqueName.equals(name)) {
          return node;
        }
      }
    }
    return null;
  }

  /**
   * Todos los nodos del proceso, incluidos los de conexion.
   */
  public static List<Object> allNodes(Object process) throws Exception {
    List<Object> nodes = new ArrayList<>();
    Object containers = invokeOrNull(process, "getAllNodeContainers");
    if (containers instanceof Iterable) {
      for (Object container : (Iterable<?>) containers) {
        Object node = invokeOrNull(container, "getNode");
        if (node != null) {
          nodes.add(node);
        }
      }
    }
    if (nodes.isEmpty()) {
      Object graphical = invokeOrNull(process, "getGraphicalNodes");
      if (graphical instanceof Iterable) {
        for (Object node : (Iterable<?>) graphical) {
          nodes.add(node);
        }
      }
    }
    return nodes;
  }

  /** Metodos ya buscados por clase: buscar un metodo por nombre es lo caro de la reflexion. */
  private static final ClassValue<Map<String, Method>> METHODS = new ClassValue<>() {
    @Override
    protected Map<String, Method> computeValue(Class<?> type) {
      return new ConcurrentHashMap<>();
    }
  };

  /** Avisos ya emitidos, para no repetir en cada peticion el mismo fallo de la API. */
  private static final Set<String> REPORTED = ConcurrentHashMap.newKeySet();

  /**
   * Invoca un metodo publico y devuelve su resultado, o null si no se puede.
   *
   * Un metodo que no existe casi siempre quiere decir que la version de Studio
   * cambio su API. Se avisa en el Error Log una vez por clase y metodo, en lugar
   * de devolver null en silencio y que parezca que el dato no existe.
   */
  public static Object invokeOrNull(Object target, String method) {
    Class<?> type = target.getClass();
    Map<String, Method> cache = METHODS.get(type);
    Method resolved = cache.get(method);
    if (resolved == null) {
      try {
        resolved = type.getMethod(method);
        cache.put(method, resolved);
      } catch (NoSuchMethodException e) {
        reportOnce("No existe " + type.getName() + "." + method + "() en esta version de Studio", e);
        return null;
      }
    }
    try {
      return resolved.invoke(target);
    } catch (Exception e) {
      reportOnce("Falla al invocar " + type.getName() + "." + method + "()", e);
      return null;
    }
  }

  private static void reportOnce(String message, Throwable cause) {
    if (REPORTED.add(message)) {
      BridgeLog.warn(message, cause);
    }
  }

  /**
   * Id interno de un job del repositorio, por su etiqueta.
   *
   * Es el atributo `id` del `.properties`, y es lo que usan las referencias
   * entre jobs (el `PROCESS` del tRunJob).
   */
  public static String internalIdOf(String jobName) throws Exception {
    Object repositoryFactory = repositoryFactory();
    if (repositoryFactory == null) {
      return null;
    }
    Class<?> enumClass = repositoryFactory.getClass().getClassLoader()
        .loadClass("org.talend.core.model.repository.ERepositoryObjectType");
    Object processType = enumClass.getField("PROCESS").get(null);
    java.lang.reflect.Method getAll = null;
    for (java.lang.reflect.Method method : repositoryFactory.getClass().getMethods()) {
      if ("getAll".equals(method.getName()) && method.getParameterTypes().length == 1
          && method.getParameterTypes()[0].getName().equals(enumClass.getName())) {
        getAll = method;
        break;
      }
    }
    if (getAll == null) {
      return null;
    }
    Object all = getAll.invoke(repositoryFactory, processType);
    if (!(all instanceof Iterable)) {
      return null;
    }
    for (Object viewObject : (Iterable<?>) all) {
      Object label = viewObject.getClass().getMethod("getLabel").invoke(viewObject);
      if (!jobName.equals(label)) {
        continue;
      }
      Object property = viewObject.getClass().getMethod("getProperty").invoke(viewObject);
      if (property == null) {
        return null;
      }
      Object id = property.getClass().getMethod("getId").invoke(property);
      return id == null ? null : String.valueOf(id);
    }
    return null;
  }

  /** Etiqueta del proyecto de Talend abierto (por ejemplo PRJ_BANCOLOMBIA). */
  public static String projectLabel() throws Exception {
    Object project = currentProject();
    if (project == null) {
      return null;
    }
    Object label = project.getClass().getMethod("getLabel").invoke(project);
    return label == null ? null : String.valueOf(label);
  }
}
