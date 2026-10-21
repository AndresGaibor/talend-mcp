package com.andres.talend.bridge.automation;

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
   * Si no hay ninguno y el spec dice que job es, se abre.
   */
  public static Object designerEditor(JsonObject spec) throws Exception {
    IEditorPart editor = WorkbenchService.activeEditorPart();
    if (editor == null) {
      String jobName = JsonSpec.string(spec, "job");
      if (jobName == null) {
        throw new IllegalStateException(
            "No hay ningun job abierto: indica 'job' en la peticion");
      }
      JsonObject jobSpec = new JsonObject();
      jobSpec.addProperty("name", jobName);
      String version = JsonSpec.string(spec, "version");
      if (version != null) {
        jobSpec.addProperty("version", version);
      }
      JobOperationsService.openJob(jobSpec);
      editor = WorkbenchService.activeEditorPart();
      if (editor == null) {
        throw new IllegalStateException("No se pudo abrir el job en el editor");
      }
    }
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
  public static Object nodeByUniqueName(Object process, String uniqueName) throws Exception {
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

  /** Invoca un metodo y devuelve su resultado, o null si falla. */
  public static Object invokeOrNull(Object target, String method) {
    try {
      return target.getClass().getMethod(method).invoke(target);
    } catch (Exception e) {
      return null;
    }
  }
}
