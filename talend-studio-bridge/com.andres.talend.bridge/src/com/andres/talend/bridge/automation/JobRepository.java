package com.andres.talend.bridge.automation;

import java.util.LinkedHashMap;
import java.util.Map;

import com.andres.talend.bridge.BridgeLog;
import com.andres.talend.bridge.workbench.WorkbenchService;

import com.google.gson.JsonObject;

import org.eclipse.core.resources.IProject;

/**
 * Ciclo de vida de un job en el repositorio de Talend.
 *
 * Crear un job desde cero tiene su propia complicacion: el item tiene que
 * nacer con su recurso EMF (el del `.item`) y el `ProcessType` dentro, o el
 * repositorio lo serializa vacio. Y borrarlo hay que hacerlo desde el
 * repositorio, no desde el disco: si no, queda un item fantasma y la proxima
 * vez que se cree un job con la misma etiqueta salta el modal "Jobname Error".
 */
public final class JobRepository {

  private JobRepository() {}

  /**
   * Crea un job vacio y lo abre en el editor.
   *
   * @param spec name, version, folder, description y replace.
   */
  public static Map<String, Object> create(JsonObject spec) throws Exception {
    String name = JsonSpec.required(spec, "name");
    // Talend exige que el label del job no tenga puntos ni guiones.
    if (!name.matches("^[a-zA-Z]+[a-zA-Z0-9_]*$")) {
      throw new IllegalArgumentException(
          "El nombre del job solo admite letras, digitos y guion bajo: " + name);
    }
    String version = version(spec);
    String folder = JsonSpec.string(spec, "folder");
    if (folder == null) {
      folder = "";
    }

    Object project = TalendApi.currentProject();
    if (project == null) {
      throw new IllegalStateException("No hay ningun proyecto de Talend abierto");
    }
    Object repositoryFactory = TalendApi.repositoryFactory();
    if (repositoryFactory == null) {
      throw new IllegalStateException("El repositorio de Talend no esta disponible");
    }

    // Si ya hay un job con esa etiqueta, Studio abre el modal "Jobname
    // Error" y el hilo de la UI se queda dentro del dialogo. Se decide
    // aqui: o se falla con un mensaje claro, o se reemplaza.
    Object existing = findByLabel(repositoryFactory, name);
    if (existing != null) {
      if (!JsonSpec.booleanOf(spec, "replace", false)) {
        throw new IllegalStateException(
            "Ya existe un job con la etiqueta '" + name + "'. Usa replace=true para reemplazarlo.");
      }
      delete(repositoryFactory, project, existing);
    }

    Object processItem = buildItem(spec, name, version);

    // El recurso del `.item`. El ultimo booleano decide el tipo: `false`
    // crea un TalendXMIResource (el del `.item`), `true` un ByteArrayResource
    // (el del `.properties`).
    Object xmiResourceManager = TalendApi.xmiResourceManager();
    IProject iProject = TalendApi.resourceProject();
    Class<?> typeClass = TalendClasses.load("org.talend.core.model.repository.ERepositoryObjectType");
    Object jobType = typeClass.getField("PROCESS").get(null);
    Object itemResource = xmiResourceManager.getClass()
        .getMethod("createItemResource", TalendClasses.load("org.eclipse.core.resources.IProject"),
            TalendClasses.load("org.talend.core.model.properties.Item"),
            org.eclipse.core.runtime.IPath.class, typeClass, boolean.class)
        .invoke(xmiResourceManager, iProject, processItem, itemResourcePath(folder, name), jobType, false);

    // El ProcessType va dentro del recurso, no suelto.
    Object talendFileFactory = TalendClasses
        .load("org.talend.designer.core.model.utils.emf.talendfile.TalendFileFactory")
        .getField("eINSTANCE").get(null);
    Object processType = talendFileFactory.getClass().getMethod("createProcessType").invoke(talendFileFactory);
    @SuppressWarnings("unchecked")
    java.util.List<Object> contents = (java.util.List<Object>) itemResource.getClass()
        .getMethod("getContents").invoke(itemResource);
    contents.add(processType);
    processItem.getClass()
        .getMethod("setProcess", TalendClasses
            .load("org.talend.designer.core.model.utils.emf.talendfile.ProcessType"))
        .invoke(processItem, processType);

    // Registrar el item en el repositorio: `create` lo deja con su recurso
    // y escribe los tres archivos del job.
    repositoryFactory.getClass()
        .getMethod("create", TalendClasses.load("org.talend.core.model.general.Project"),
            TalendClasses.load("org.talend.core.model.properties.Item"),
            org.eclipse.core.runtime.IPath.class, boolean[].class)
        .invoke(repositoryFactory, project, processItem, processPath(folder, name), new boolean[0]);

    Map<String, Object> opened = openCreatedJob(name, version);
    if (!Boolean.TRUE.equals(opened.get("opened"))) {
      throw new IllegalStateException(
          "No se pudo abrir el job recien creado: " + opened.get("error"));
    }
    Map<String, Object> summary = new LinkedHashMap<>();
    summary.put("jobName", name);
    summary.put("version", version);
    summary.put("editorTitle", opened.get("editorTitle"));
    return summary;
  }

  /**
   * Borra un job del repositorio, con sus archivos.
   */
  public static Map<String, Object> delete(JsonObject spec) throws Exception {
    String name = JsonSpec.required(spec, "name");
    Object project = TalendApi.currentProject();
    if (project == null) {
      throw new IllegalStateException("No hay ningun proyecto de Talend abierto");
    }
    Object repositoryFactory = TalendApi.repositoryFactory();
    if (repositoryFactory == null) {
      throw new IllegalStateException("El repositorio de Talend no esta disponible");
    }
    Object viewObject = findByLabel(repositoryFactory, name);
    Map<String, Object> summary = new LinkedHashMap<>();
    summary.put("jobName", name);
    if (viewObject == null) {
      summary.put("deleted", false);
      summary.put("message", "No habia ningun job con esa etiqueta");
      return summary;
    }
    delete(repositoryFactory, project, viewObject);
    // Ademas del item, se borra el proyecto Java que Studio dejo generado en
    // el workspace (poms/jobs/process/<job>). Si no, al recrear el job
    // Talend reutiliza ese proyecto, con su target y su .project viejos, y
    // la ejecucion falla con "El recurso .../src/main/java/... no existe".
    summary.put("generatedProjectRemoved", deleteGeneratedProject(name));
    summary.put("deleted", true);
    return summary;
  }

  /**
   * Borra el proyecto Java que Studio genero para un job.
   *
   * Vive en el proyecto de Eclipse, bajo `poms/jobs/process`. Se busca en
   * cualquier subcarpeta, porque el job puede estar dentro de una carpeta.
   */
  private static boolean deleteGeneratedProject(String name) {
    try {
      IProject iProject = TalendApi.resourceProject();
      if (iProject == null) {
        return false;
      }
      org.eclipse.core.resources.IFolder root = iProject.getFolder("poms/jobs/process");
      if (!root.exists()) {
        return false;
      }
      for (org.eclipse.core.resources.IResource member : root.members()) {
        if (member instanceof org.eclipse.core.resources.IFolder
            && name.equals(((org.eclipse.core.resources.IFolder) member).getName())) {
          return deleteFolder((org.eclipse.core.resources.IFolder) member);
        }
        if (member instanceof org.eclipse.core.resources.IFolder) {
          org.eclipse.core.resources.IFolder folder = (org.eclipse.core.resources.IFolder) member;
          for (org.eclipse.core.resources.IResource child : folder.members()) {
            if (child instanceof org.eclipse.core.resources.IFolder
                && name.equals(((org.eclipse.core.resources.IFolder) child).getName())) {
              return deleteFolder((org.eclipse.core.resources.IFolder) child);
            }
          }
        }
      }
    } catch (Exception e) {
      BridgeLog.warn("No se pudo borrar el proyecto generado del job '" + name + "'", e);
    }
    return false;
  }

  /** Borra una carpeta y todo su contenido. */
  private static boolean deleteFolder(org.eclipse.core.resources.IFolder folder) {
    try {
      folder.delete(true, true, null);
      return true;
    } catch (Exception e) {
      BridgeLog.warn("No se pudo borrar la carpeta " + folder.getName(), e);
      return false;
    }
  }

  /**
   * Abre un job del proyecto en el editor.
   */
  public static Map<String, Object> open(JsonObject spec) throws Exception {
    String name = JsonSpec.required(spec, "name");
    String version = version(spec);

    // Si el job ya esta abierto, se activa el editor que hay. Abrirlo otra
    // vez crea un segundo editor, con su propio proceso en memoria, y las
    // operaciones pueden acabar en el que no toca.
    org.eclipse.ui.IEditorPart existing = TalendApi.editorOfJob(name);
    if (existing != null) {
      Map<String, Object> result = new LinkedHashMap<>();
      result.put("opened", true);
      result.put("editorTitle", existing.getTitle());
      return result;
    }

    org.eclipse.core.resources.IFile file = itemFile(name, version);
    if (file == null || !file.exists()) {
      throw new IllegalStateException("No existe el job '" + name + "' en el proyecto");
    }
    Map<String, Object> opened = WorkbenchService.openResource(file.getLocation().toOSString());
    if (!Boolean.TRUE.equals(opened.get("opened"))) {
      throw new IllegalStateException("No se pudo abrir el job: " + opened.get("error"));
    }
    return opened;
  }

  // ---------------------------------------------------------------------
  // Internos
  // ---------------------------------------------------------------------

  /** Item del repositorio con sus datos, listo para registrarse. */
  private static Object buildItem(JsonObject spec, String name, String version) throws Exception {
    Class<?> factoryClass = TalendClasses.load("org.talend.core.model.properties.PropertiesFactory");
    Object factory = factoryClass.getField("eINSTANCE").get(null);

    Object property = factoryClass.getMethod("createProperty").invoke(factory);
    property.getClass().getMethod("setId", String.class).invoke(property, generateId());
    property.getClass().getMethod("setLabel", String.class).invoke(property, name);
    property.getClass().getMethod("setDisplayName", String.class).invoke(property, name);
    property.getClass().getMethod("setVersion", String.class).invoke(property, version);
    String description = JsonSpec.string(spec, "description");
    if (description != null && !description.isEmpty()) {
      property.getClass().getMethod("setDescription", String.class).invoke(property, description);
    }

    Object processItem = factoryClass.getMethod("createProcessItem").invoke(factory);
    processItem.getClass().getMethod("setProperty",
        TalendClasses.load("org.talend.core.model.properties.Property")).invoke(processItem, property);

    // El ItemState marca el item como vivo. Sin el, el repositorio lo
    // considera borrado.
    Object state = factoryClass.getMethod("createItemState").invoke(factory);
    processItem.getClass().getMethod("setState",
        TalendClasses.load("org.talend.core.model.properties.ItemState")).invoke(processItem, state);
    return processItem;
  }

  /** Job del proyecto por su etiqueta. */
  private static Object findByLabel(Object repositoryFactory, String name) throws Exception {
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
      if (name.equals(label)) {
        return viewObject;
      }
    }
    return null;
  }

  /** Borra un item del repositorio y sus archivos. */
  private static void delete(Object repositoryFactory, Object project, Object viewObject)
      throws Exception {
    // El repositorio expone varias firmas de `deleteObjectPhysical`. Se usa
    // la mas simple: borra el item y sus archivos.
    java.lang.reflect.Method delete = null;
    for (java.lang.reflect.Method method : repositoryFactory.getClass().getMethods()) {
      if (!"deleteObjectPhysical".equals(method.getName())) {
        continue;
      }
      Class<?>[] parameters = method.getParameterTypes();
      if (parameters.length == 2
          && parameters[0].getName().equals("org.talend.core.model.general.Project")) {
        delete = method;
        break;
      }
    }
    if (delete == null) {
      throw new IllegalStateException("El repositorio no permite borrar items");
    }
    delete.invoke(repositoryFactory, project, viewObject);
  }

  /**
   * Ruta de la carpeta del item para el repositorio.
   *
   * El repositorio antepone la carpeta del tipo de objeto (`process`) y crea
   * dentro los tres archivos del job. Por eso la ruta es solo el nombre de la
   * carpeta, sin `process` delante.
   */
  private static org.eclipse.core.runtime.IPath processPath(String folder, String name) {
    org.eclipse.core.runtime.IPath path = org.eclipse.core.runtime.Path.fromOSString(name);
    if (folder != null && !folder.trim().isEmpty()) {
      for (String part : folder.split("/")) {
        if (!part.trim().isEmpty()) {
          path = path.append(part);
        }
      }
    }
    return path;
  }

  /**
   * Ruta completa del item, con la carpeta del tipo de objeto.
   *
   * Es la que espera `XmiResourceManager.createItemResource`.
   */
  private static org.eclipse.core.runtime.IPath itemResourcePath(String folder, String name) {
    return org.eclipse.core.runtime.Path.fromOSString("process").append(processPath(folder, name));
  }

  /** Archivo `.item` de un job del proyecto. */
  private static org.eclipse.core.resources.IFile itemFile(String name, String version)
      throws Exception {
    IProject iProject = TalendApi.resourceProject();
    if (iProject == null) {
      return null;
    }
    org.eclipse.core.resources.IFolder jobFolder = iProject.getFolder("process").getFolder(name);
    jobFolder.refreshLocal(org.eclipse.core.resources.IResource.DEPTH_ZERO, null);
    return jobFolder.getFile(name + "_" + version + ".item");
  }

  /** Abre el job recien creado en el editor. */
  private static Map<String, Object> openCreatedJob(String name, String version) throws Exception {
    org.eclipse.core.resources.IFile file = itemFile(name, version);
    if (file == null || !file.exists()) {
      Map<String, Object> payload = new LinkedHashMap<>();
      payload.put("opened", false);
      payload.put("error", "El item recien creado no esta en el arbol de recursos");
      return payload;
    }
    return WorkbenchService.openResource(file.getLocation().toOSString());
  }

  /** Identificador unico con el formato que usa Talend. */
  private static String generateId() {
    return "_" + Long.toHexString(System.nanoTime());
  }

  /** Version del job, por defecto "0.1". */
  private static String version(JsonObject spec) {
    String version = JsonSpec.string(spec, "version");
    if (version == null || version.trim().isEmpty()) {
      return "0.1";
    }
    return version;
  }
}
