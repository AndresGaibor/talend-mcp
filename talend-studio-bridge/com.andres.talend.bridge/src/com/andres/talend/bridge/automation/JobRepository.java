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
    // Un job de Big Data se registra como "Big Data Batch" (PROCESS_MR), no como
    // "Job Designs": el editor usa ese tipo para saber que paleta mostrar.
    Object jobType = typeClass.getField("PROCESS").get(null);
    String framework = JsonSpec.string(spec, "framework");
    if (framework != null && !framework.trim().isEmpty()) {
      try {
        jobType = typeClass.getField("PROCESS_MR").get(null);
      } catch (Exception e) {
        BridgeLog.warn("El repositorio no tiene el tipo de job de Big Data", e);
      }
    }    Object itemResource = xmiResourceManager.getClass()
        .getMethod("createItemResource", TalendClasses.load("org.eclipse.core.resources.IProject"),
            TalendClasses.load("org.talend.core.model.properties.Item"),
            org.eclipse.core.runtime.IPath.class, typeClass, boolean.class)
        .invoke(xmiResourceManager, iProject, processItem,
            "process_mr".equals(jobFolder(spec))
                ? mapReduceItemResourcePath(folder, name)
                : itemResourcePath(folder, name),
            jobType, false);

    // El ProcessType va dentro del recurso, no suelto.
    Object talendFileFactory = TalendClasses
        .load("org.talend.designer.core.model.utils.emf.talendfile.TalendFileFactory")
        .getField("eINSTANCE").get(null);
    Object processType = talendFileFactory.getClass().getMethod("createProcessType").invoke(talendFileFactory);

    // El tipo de job decide que paleta de componentes usa el editor: un job
    // "Big_Data_Batch" con framework "Spark" es un job de Spark Batch, y en el
    // catalogo hay 166 componentes que solo valen en jobs de ese tipo.
    String tipoDeJob = JsonSpec.string(spec, "jobType");
    if (tipoDeJob != null && !tipoDeJob.trim().isEmpty()) {
      processType.getClass().getMethod("setJobType", String.class).invoke(processType, tipoDeJob.trim());
    }
    if (framework != null && !framework.trim().isEmpty()) {
      try {
        processType.getClass().getMethod("setFramework", String.class).invoke(processType, framework.trim());
      } catch (Exception e) {
        BridgeLog.warn("El ProcessType no admite el framework '" + framework + "'", e);
      }
    }
    @SuppressWarnings("unchecked")
    java.util.List<Object> contents = (java.util.List<Object>) itemResource.getClass()
        .getMethod("getContents").invoke(itemResource);
    contents.add(processType);
    processItem.getClass()
        .getMethod("setProcess", TalendClasses
            .load("org.talend.designer.core.model.utils.emf.talendfile.ProcessType"))
        .invoke(processItem, processType);

    // Registrar el item en el repositorio: `create` lo deja con su recurso
    // y escribe los tres archivos del job. Los jobs de Big Data van con la
    // carpeta vacia: sus archivos quedan en `process_mr` directamente, no en
    // una carpeta por job.
    org.eclipse.core.runtime.IPath ruta = "process_mr".equals(jobFolder(spec))
        ? mapReduceProcessPath(folder)
        : processPath(folder, name);
    repositoryFactory.getClass()
        .getMethod("create", TalendClasses.load("org.talend.core.model.general.Project"),
            TalendClasses.load("org.talend.core.model.properties.Item"),
            org.eclipse.core.runtime.IPath.class, boolean[].class)
        .invoke(repositoryFactory, project, processItem, ruta, new boolean[0]);

    Map<String, Object> opened = openCreatedJob(name, version);
    if (!Boolean.TRUE.equals(opened.get("opened"))) {
      throw new IllegalStateException(
          "No se pudo abrir el job recien creado: " + opened.get("error"));
    }
    Map<String, Object> summary = new LinkedHashMap<>();
    summary.put("jobName", name);
    summary.put("version", version);
    summary.put("jobType", tipoDeJob == null ? "Standard" : tipoDeJob);
    if (framework != null && !framework.trim().isEmpty()) {
      summary.put("framework", framework.trim());
    }
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
    // El editor del job no se cierra solo al borrarlo (ni existe ya el item
    // cuando es un resto de un borrado anterior): se cierra siempre, para que
    // no quede un editor obsoleto con el nombre que se va a reutilizar.
    int editorsClosed = TalendApi.closeEditorsOfJob(name);
    Object viewObject = findByLabel(repositoryFactory, name);
    Map<String, Object> summary = new LinkedHashMap<>();
    summary.put("jobName", name);
    summary.put("editorsClosed", editorsClosed);
    // El proyecto Java generado se borra siempre, haya job o no: si se queda
    // una copia, Maven ve el proyecto dos veces y el build falla con "Project
    // ... is duplicated in the reactor".
    summary.put("generatedProjectRemoved", deleteGeneratedProject(name, version(spec)));
    if (viewObject == null) {
      summary.put("deleted", false);
      summary.put("message", "No habia ningun job con esa etiqueta");
      return summary;
    }
    delete(repositoryFactory, project, viewObject);
    summary.put("deleted", true);
    return summary;
  }

  /**
   * Borra el proyecto Java que Studio genero para un job.
   *
   * Vive en el proyecto de Eclipse, bajo `poms/jobs/process`, y su carpeta se
   * llama `<etiqueta>_<version>` (en minusculas). Hay dos sitios posibles: junto
   * a los demas (`process/mcp_coverage_0.1`) o dentro de la carpeta del job
   * (`process/MCP_Coverage/mcp_coverage_0.1`).
   *
   * Si se deja uno, Maven ve el mismo proyecto dos veces y el build falla con
   * "Project ... is duplicated in the reactor": el job no compila.
   */
  private static boolean deleteGeneratedProject(String name, String version) {
    try {
      IProject iProject = TalendApi.resourceProject();
      if (iProject == null) {
        return false;
      }
      boolean deleted = false;

      // El proyecto Maven de un job es un proyecto de Eclipse (su carpeta
      // lleva un `.project`). Se borra el proyecto entero, no solo la carpeta:
      // si no, m2e se queda con su entrada en el estado del workspace y el
      // build de cualquier job falla con "El recurso .../pom.xml no existe".
      for (org.eclipse.core.resources.IProject candidate
          : iProject.getWorkspace().getRoot().getProjects()) {
        if (isGeneratedProject(candidate.getLocation() == null ? ""
            : candidate.getLocation().toOSString(), name, version)) {
          deleted |= deleteProject(candidate);
        }
      }

      // Y por si queda alguna carpeta suelta (un proyecto sin `.project`),
      // se borra tambien.
      org.eclipse.core.resources.IFolder root = iProject.getFolder("poms/jobs/process");
      if (root.exists()) {
        for (org.eclipse.core.resources.IResource member : root.members()) {
          if (!(member instanceof org.eclipse.core.resources.IFolder)) {
            continue;
          }
          org.eclipse.core.resources.IFolder folder = (org.eclipse.core.resources.IFolder) member;
          if (isGeneratedProject(folder.getName(), name, version)) {
            deleted |= deleteFolder(folder);
            continue;
          }
          for (org.eclipse.core.resources.IResource child : folder.members()) {
            if (child instanceof org.eclipse.core.resources.IFolder
                && isGeneratedProject(((org.eclipse.core.resources.IFolder) child).getName(),
                    name, version)) {
              deleted |= deleteFolder((org.eclipse.core.resources.IFolder) child);
            }
          }
        }
      }
      return deleted;
    } catch (Exception e) {
      BridgeLog.warn("No se pudo borrar el proyecto generado del job '" + name + "'", e);
    }
    return false;
  }

  /** Borra un proyecto de Eclipse con todo su contenido. */
  private static boolean deleteProject(org.eclipse.core.resources.IProject project) {
    try {
      project.delete(true, true, null);
      return true;
    } catch (Exception e) {
      BridgeLog.warn("No se pudo borrar el proyecto " + project.getName(), e);
      return false;
    }
  }

  /**
   * Si una ruta es el proyecto generado de un job.
   *
   * La carpeta se llama `<etiqueta>_<version>`, y Studio la crea en minusculas.
   */
  private static boolean isGeneratedProject(String ruta, String name, String version) {
    String carpeta = ruta.replace('\\', '/').toLowerCase();
    String etiqueta = name.toLowerCase();
    String v = version.toLowerCase();
    return carpeta.equals(etiqueta + "_" + v) || carpeta.endsWith("/" + etiqueta + "_" + v);
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

    // Los jobs de Big Data (Spark Batch, Spark Streaming) no son un `ProcessItem`
    // normal: son un `MapReduceProcessItem`, y su propiedad lleva el framework
    // (FRAMEWORK=Spark). Sin esto, el editor abre el job como Standard y no
    // deja usar los componentes de Spark.
    String framework = JsonSpec.string(spec, "framework");
    boolean bigData = framework != null && !framework.trim().isEmpty();
    if (bigData) {
      addAdditionalProperty(property, "FRAMEWORK", framework.trim());
    }

    Object processItem;
    if (bigData) {
      processItem = createMapReduceProcessItem();
    } else {
      processItem = factoryClass.getMethod("createProcessItem").invoke(factory);
    }
    processItem.getClass().getMethod("setProperty",
        TalendClasses.load("org.talend.core.model.properties.Property")).invoke(processItem, property);

    // El ItemState marca el item como vivo. Sin el, el repositorio lo
    // considera borrado.
    Object state = factoryClass.getMethod("createItemState").invoke(factory);
    processItem.getClass().getMethod("setState",
        TalendClasses.load("org.talend.core.model.properties.ItemState")).invoke(processItem, state);
    return processItem;
  }

  /**
   * Item de un job de Big Data.
   *
   * Vive en el plugin del designer de MapReduce, no en el modelo base: si el
   * plugin no esta instalado, se avisa y se sigue con el item normal.
   */
  private static Object createMapReduceProcessItem() throws Exception {
    Class<?> factoryClass;
    try {
      factoryClass = TalendClasses.load("org.talend.designer.mapreduce.mapRedProperties.MapRedPropertiesFactory");
    } catch (Exception e) {
      BridgeLog.warn("No esta el plugin de MapReduce: el job se creara como Standard", e);
      Class<?> base = TalendClasses.load("org.talend.core.model.properties.PropertiesFactory");
      return base.getMethod("createProcessItem").invoke(base.getField("eINSTANCE").get(null));
    }
    Object factory = factoryClass.getField("eINSTANCE").get(null);
    for (java.lang.reflect.Method method : factoryClass.getMethods()) {
      if (method.getName().toLowerCase().contains("processitem") && method.getParameterCount() == 0) {
        return method.invoke(factory);
      }
    }
    throw new IllegalStateException("No se encontro el item de MapReduce");
  }

  /**
   * Anade una propiedad adicional a la propiedad del item (FRAMEWORK...).
   *
   * El mapa de propiedades de EMF (`EcoreEMap`) no es un `java.util.Map`: hay
   * que llamarle al `put` por reflexion.
   */
  private static void addAdditionalProperty(Object property, String key, String value) {
    try {
      Object additional = property.getClass().getMethod("getAdditionalProperties").invoke(property);
      if (additional == null) {
        return;
      }
      additional.getClass().getMethod("put", Object.class, Object.class)
          .invoke(additional, key, value);
    } catch (Exception e) {
      BridgeLog.warn("No se pudo anadir la propiedad '" + key + "' al item", e);
    }
  }

  /** Job del proyecto por su etiqueta. */
  static Object findByLabel(Object repositoryFactory, String name) throws Exception {
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
   * Es la que espera `XmiResourceManager.createItemResource`. Los jobs de Big
   * Data van en `process_mr`, no en `process`.
   */
  private static org.eclipse.core.runtime.IPath itemResourcePath(String folder, String name) {
    return org.eclipse.core.runtime.Path.fromOSString("process").append(processPath(folder, name));
  }

  /**
   * Ruta completa del item de un job de Big Data (`process_mr`).
   */
  private static org.eclipse.core.runtime.IPath mapReduceItemResourcePath(String folder, String name) {
    return org.eclipse.core.runtime.Path.fromOSString("process_mr").append(processPath(folder, name));
  }

  /**
   * Ruta del item de un job de Big Data dentro de `process_mr`.
   *
   * Los jobs de Big Data no tienen carpeta propia: sus tres archivos quedan
   * en `process_mr` con el nombre del job.
   */
  private static org.eclipse.core.runtime.IPath mapReduceProcessPath(String folder) {
    org.eclipse.core.runtime.IPath path = org.eclipse.core.runtime.Path.fromOSString("");
    if (folder != null && !folder.trim().isEmpty()) {
      for (String part : folder.split("/")) {
        if (!part.trim().isEmpty()) {
          path = path.append(part);
        }
      }
    }
    return path;
  }

  /** Carpeta del proyecto donde viven los jobs, segun su tipo. */
  private static String jobFolder(JsonObject spec) {
    String framework = JsonSpec.string(spec, "framework");
    return framework != null && !framework.trim().isEmpty() ? "process_mr" : "process";
  }

  /** Archivo `.item` de un job del proyecto. */
  private static org.eclipse.core.resources.IFile itemFile(String name, String version)
      throws Exception {
    IProject iProject = TalendApi.resourceProject();
    if (iProject == null) {
      return null;
    }
    // Los jobs de Big Data estan en `process_mr` y sin carpeta propia; los
    // normales, en `process` y con una carpeta por job.
    for (String base : new String[] {"process", "process_mr"}) {
      org.eclipse.core.resources.IFolder root = iProject.getFolder(base);
      root.refreshLocal(org.eclipse.core.resources.IResource.DEPTH_ZERO, null);
      org.eclipse.core.resources.IFile file = root.getFile(name + "_" + version + ".item");
      if (file.exists()) {
        return file;
      }
      org.eclipse.core.resources.IFolder jobFolder = root.getFolder(name);
      jobFolder.refreshLocal(org.eclipse.core.resources.IResource.DEPTH_ZERO, null);
      file = jobFolder.getFile(name + "_" + version + ".item");
      if (file.exists()) {
        return file;
      }
    }
    return null;
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
  static String generateId() {
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
