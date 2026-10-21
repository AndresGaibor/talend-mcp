package com.andres.talend.bridge.automation;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

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

  /** Nodo del proceso por su unique name. */
  public static Object nodeByUniqueNameLegacy(Object process, String uniqueName) throws Exception {
    Object nodes = process.getClass().getMethod("getGraphicalNodes").invoke(process);
    if (nodes instanceof Iterable) {
      for (Object node : (Iterable<?>) nodes) {
        Object name = node.getClass().getMethod("getUniqueName").invoke(node);
        if (uniqueName.equals(name)) {
          return node;
        }
      }
    }
    return null;
  }

  /**
   * Componente del catalogo por su nombre.
   *
   * El catalogo lo publica Talend con `IComponentsService`.
   */
  public static Object findCatalogComponent(String componentName) throws Exception {
    Class<?> serviceClass = TalendClasses.load("org.talend.core.model.components.IComponentsService");
    Object service = serviceClass.getMethod("get").invoke(null);
    Object factory = service.getClass().getMethod("getComponentsFactory").invoke(service);
    Object components = factory.getClass().getMethod("getComponents").invoke(factory);
    if (components instanceof Set) {
      for (Object candidate : (Set<?>) components) {
        Object name = candidate.getClass().getMethod("getName").invoke(candidate);
        if (componentName.equals(name)) {
          return candidate;
        }
      }
    }
    return null;
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

  /** Invoca un metodo y devuelve su resultado, o null si falla. */
  public static Object invokeOrNull(Object target, String method) {
    try {
      return target.getClass().getMethod(method).invoke(target);
    } catch (Exception e) {
      return null;
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
