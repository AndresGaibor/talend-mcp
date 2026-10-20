package com.andres.talend.bridge.automation;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import com.andres.talend.bridge.BridgeLog;
import com.andres.talend.bridge.workbench.WorkbenchService;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import org.eclipse.core.resources.IProject;
import org.eclipse.draw2d.geometry.Point;
import org.eclipse.gef.EditPart;
import org.eclipse.gef.commands.Command;

/**
 * Opera sobre el job abierto en Talend Studio con la API del propio IDE.
 *
 * Antes el MCP escribia el `.item` a mano. Eso obligaba a reproducir el
 * formato XML de Talend (context, metadata, LENGTHS, tipos Java) y a forzar
 * despues la recarga del modelo EMF, porque Studio no se entera de los
 * cambios hechos por fuera. Con esta API el modelo en memoria siempre es la
 * fuente de verdad y el formato lo pone Talend.
 *
 * Las operaciones de nodos y conexiones se hacen con los mismos comandos que
 * usa el editor de Talend: `CreateRequest` para anadir un nodo,
 * `ConnectionCreateCommand` para conectar y `DeleteNodeContainerCommand` para
 * borrar. Asi cada nodo nace con todos sus parametros y valores por defecto.
 *
 * Todo se hace por reflexion para no atar el bundle a los bundles de Talend:
 * el plugin se instala junto a distintas versiones de Studio.
 */
public final class JobOperationsService {

  private JobOperationsService() {}

  // ---------------------------------------------------------------------
  // Operaciones
  // ---------------------------------------------------------------------

  /**
   * Crea un job vacio en el repositorio de Talend y lo abre en el editor.
   *
   * El job se crea con la API del repositorio, de modo que Studio se encarga
   * del `.item` y del `.properties`. Despues se pueden anadir nodos con
   * `addNode` y conectarlos con `connect`.
   *
   * @param spec name, version, folder y description del job.
   */
  public static Map<String, Object> createJob(JsonObject spec) {
    return run("create-job", () -> {
      String name = required(spec, "name");
      // Talend exige que el label del job no tenga puntos ni guiones.
      if (!name.matches("^[a-zA-Z]+[a-zA-Z0-9_]*$")) {
        throw new IllegalArgumentException(
            "El nombre del job solo admite letras, digitos y guion bajo: " + name);
      }
      String version = string(spec, "version");
      if (version == null || version.trim().isEmpty()) {
        version = "0.1";
      }
      String folder = string(spec, "folder");
      if (folder == null) {
        folder = "";
      }

      Object project = currentProject();
      if (project == null) {
        throw new IllegalStateException("No hay ningun proyecto de Talend abierto");
      }

      // La propiedad y el item son la base del job en el repositorio. Son
      // objetos EMF: se crean con la factoria del modelo.
      Object factory = talendClass("org.talend.core.model.properties.PropertiesFactory")
          .getField("eINSTANCE").get(null);
      Object property = factory.getClass().getMethod("createProperty").invoke(factory);
      property.getClass().getMethod("setId", String.class).invoke(property, generateId());
      property.getClass().getMethod("setLabel", String.class).invoke(property, name);
      property.getClass().getMethod("setDisplayName", String.class).invoke(property, name);
      property.getClass().getMethod("setVersion", String.class).invoke(property, version);
      String description = string(spec, "description");
      if (description != null && !description.isEmpty()) {
        property.getClass().getMethod("setDescription", String.class).invoke(property, description);
      }

      Object processItem = factory.getClass().getMethod("createProcessItem").invoke(factory);
      processItem.getClass().getMethod("setProperty",
          talendClass("org.talend.core.model.properties.Property")).invoke(processItem, property);

      // El ProcessItem guarda dentro el ProcessType, que es el contenido del
      // `.item`. Sin el, el repositorio no puede serializar el job.
      Object processType = talendClass(
          "org.talend.designer.core.model.utils.emf.talendfile.TalendFileFactory")
          .getField("eINSTANCE").get(null);
      Object emptyProcess = processType.getClass().getMethod("createProcessType").invoke(processType);
      processItem.getClass().getMethod("setProcess",
          talendClass("org.talend.designer.core.model.utils.emf.talendfile.ProcessType"))
          .invoke(processItem, emptyProcess);

      // El ItemState marca el item como vivo. Sin el, el repositorio lo
      // considera borrado.
      Object state = factory.getClass().getMethod("createItemState").invoke(factory);
      processItem.getClass().getMethod("setState",
          talendClass("org.talend.core.model.properties.ItemState")).invoke(processItem, state);

      Object repositoryFactory = repositoryFactory();
      if (repositoryFactory == null) {
        throw new IllegalStateException("El repositorio de Talend no esta disponible");
      }
      repositoryFactory.getClass()
          .getMethod("create", talendClass("org.talend.core.model.general.Project"),
              talendClass("org.talend.core.model.properties.Item"),
              org.eclipse.core.runtime.IPath.class, boolean[].class)
          .invoke(repositoryFactory, project, processItem, processPath(folder, name, version),
              new boolean[0]);

      // Abrir el job: a partir de aqui se opera sobre el, con el editor.
      Map<String, Object> opened = openCreatedJob(processItem, name, version);
      if (!Boolean.TRUE.equals(opened.get("opened"))) {
        throw new IllegalStateException(
            "No se pudo abrir el job recien creado: " + opened.get("error"));
      }

      Map<String, Object> summary = new LinkedHashMap<>();
      summary.put("jobName", name);
      summary.put("version", version);
      summary.put("editorTitle", opened.get("editorTitle"));
      return summary;
    });
  }

  /**
   * Anade un nodo al job abierto.
   *
   * @param spec componente: type, label, position, parameters.
   */
  public static Map<String, Object> addNode(JsonObject spec) {
    return run("add-node", () -> {
      Object editor = designerEditor();
      if (editor == null) {
        throw new IllegalStateException("No hay ningun job abierto en el editor");
      }
      String componentName = required(spec, "type");
      Object catalogComponent = findCatalogComponent(componentName);
      if (catalogComponent == null) {
        throw new IllegalStateException(
            "Componente '" + componentName + "' no encontrado en el catalogo de Talend");
      }

      // Node(component) es lo que hace el palette de Studio al soltar el
      // componente: crea el nodo con la definicion del componente y todos
      // sus parametros y valores por defecto.
      Class<?> nodeClass = talendClass("org.talend.designer.core.ui.editor.nodes.Node");
      Object node = nodeClass
          .getConstructor(talendClass("org.talend.core.model.components.IComponent"))
          .newInstance(catalogComponent);

      // El nodo entra en el proceso dentro de un NodeContainer, que es lo que
      // hace el comando de alta del editor.
      Class<?> containerClass = talendClass(
          "org.talend.designer.core.ui.editor.nodecontainer.NodeContainer");
      Object nodeContainer = containerClass.getConstructor(nodeClass).newInstance(node);

      Object process = processOf(editor);
      Class<?> commandClass = talendClass(
          "org.talend.designer.core.ui.editor.cmd.CreateNodeContainerCommand");
      Command command = (Command) commandClass
          .getConstructor(talendClass("org.talend.designer.core.ui.editor.process.Process"),
              containerClass, Point.class)
          .newInstance(process, nodeContainer, positionOf(spec));

      // El command stack es quien registra el nodo en el modelo y lo dibuja.
      Object commandStack = editor.getClass().getMethod("getCommandStack").invoke(editor);
      commandStack.getClass().getMethod("execute", Command.class).invoke(commandStack, command);

      applyParameters(node, spec);
      String label = string(spec, "label");
      if (label != null) {
        node.getClass().getMethod("setLabel", String.class).invoke(node, label);
      }
      return nodeSummary(node);
    });
  }

  /**
   * Conecta dos nodos del job abierto.
   *
   * @param spec source, target y type del conector.
   */
  public static Map<String, Object> connect(JsonObject spec) {
    return run("connect", () -> {
      Object editor = designerEditor();
      if (editor == null) {
        throw new IllegalStateException("No hay ningun job abierto en el editor");
      }
      Object process = processOf(editor);
      String sourceName = required(spec, "source");
      String targetName = required(spec, "target");

      Object source = nodeByUniqueName(process, sourceName);
      Object target = nodeByUniqueName(process, targetName);
      if (source == null) {
        throw new IllegalStateException("No existe el nodo origen '" + sourceName + "'");
      }
      if (target == null) {
        throw new IllegalStateException("No existe el nodo destino '" + targetName + "'");
      }

      // ConnectionCreateCommand es el comando que usa el editor al arrastrar
      // una conexion entre dos nodos.
      Class<?> commandClass = talendClass("org.talend.designer.core.ui.editor.cmd.ConnectionCreateCommand");
      Object command = commandClass
          .getConstructor(talendClass("org.talend.designer.core.ui.editor.nodes.Node"),
              String.class, List.class)
          .newInstance(source, connectorOf(spec), new ArrayList<Object>());
      commandClass.getMethod("setTarget", talendClass("org.talend.designer.core.ui.editor.nodes.Node"))
          .invoke(command, target);
      commandClass.getMethod("execute").invoke(command);

      Map<String, Object> summary = new LinkedHashMap<>();
      summary.put("source", sourceName);
      summary.put("target", targetName);
      summary.put("connector", connectorOf(spec));
      return summary;
    });
  }

  /**
   * Cambia los parametros de un nodo del job abierto.
   *
   * @param spec uniqueName del nodo y parameters a cambiar.
   */
  public static Map<String, Object> updateNode(JsonObject spec) {
    return run("update-node", () -> {
      Object editor = designerEditor();
      if (editor == null) {
        throw new IllegalStateException("No hay ningun job abierto en el editor");
      }
      Object process = processOf(editor);
      String uniqueName = required(spec, "uniqueName");
      Object node = nodeByUniqueName(process, uniqueName);
      if (node == null) {
        throw new IllegalStateException("No existe el nodo '" + uniqueName + "'");
      }

      applyParameters(node, spec);
      String label = string(spec, "label");
      if (label != null) {
        node.getClass().getMethod("setLabel", String.class).invoke(node, label);
      }
      return nodeSummary(node);
    });
  }

  /**
   * Borra nodos del job abierto.
   *
   * @param spec uniqueNames de los nodos a borrar.
   */
  public static Map<String, Object> deleteNodes(JsonObject spec) {
    return run("delete-nodes", () -> {
      Object editor = designerEditor();
      if (editor == null) {
        throw new IllegalStateException("No hay ningun job abierto en el editor");
      }
      Object process = processOf(editor);

      List<Object> nodes = new ArrayList<>();
      List<String> removed = new ArrayList<>();
      for (String uniqueName : stringList(spec, "uniqueNames")) {
        Object node = nodeByUniqueName(process, uniqueName);
        if (node == null) {
          continue;
        }
        nodes.add(node);
        removed.add(uniqueName);
      }
      if (nodes.isEmpty()) {
        throw new IllegalStateException("No se encontro ningun nodo a borrar");
      }

      // DeleteNodeContainerCommand es el comando que usa el editor al
      // seleccionar un nodo y pulsar suprimir.
      Class<?> commandClass = talendClass("org.talend.designer.core.ui.editor.cmd.DeleteNodeContainerCommand");
      Object command = commandClass
          .getConstructor(talendClass("org.talend.core.model.process.IProcess2"), List.class)
          .newInstance(process, nodes);
      commandClass.getMethod("execute").invoke(command);

      Map<String, Object> summary = new LinkedHashMap<>();
      summary.put("removed", removed);
      return summary;
    });
  }

  /**
   * Copia un nodo del job abierto.
   *
   * @param spec uniqueName del nodo y opcionalmente newUniqueName.
   */
  public static Map<String, Object> copyNode(JsonObject spec) {
    return run("copy-node", () -> {
      Object editor = designerEditor();
      if (editor == null) {
        throw new IllegalStateException("No hay ningun job abierto en el editor");
      }
      Object process = processOf(editor);
      String uniqueName = required(spec, "uniqueName");
      Object node = nodeByUniqueName(process, uniqueName);
      if (node == null) {
        throw new IllegalStateException("No existe el nodo '" + uniqueName + "'");
      }

      // NodesPasteCommand es el comando que usa el editor al copiar y pegar
      // un nodo.
      Class<?> commandClass = talendClass("org.talend.designer.core.ui.editor.cmd.NodesPasteCommand");
      Object command = commandClass
          .getConstructor(List.class, talendClass("org.talend.core.model.process.IProcess2"), Point.class)
          .newInstance(new ArrayList<Object>(), process, positionOf(spec));

      // El comando de pegado trabaja con NodePart, no con el modelo. Se crea
      // la parte grafica del nodo original, que es lo que el portapapeles
      // guarda.
      Object nodePart = nodePartOf(editor, node);
      List<Object> parts = new ArrayList<>();
      parts.add(nodePart);
      commandClass.getConstructor(List.class, talendClass("org.talend.core.model.process.IProcess2"), Point.class)
          .newInstance(parts, process, positionOf(spec));
      commandClass.getMethod("execute").invoke(command);

      Map<String, Object> summary = new LinkedHashMap<>();
      summary.put("copied", uniqueName);
      return summary;
    });
  }

  /**
   * Lista los nodos del job abierto.
   */
  public static Map<String, Object> listNodes() {
    return run("list-nodes", () -> {
      Object editor = designerEditor();
      if (editor == null) {
        throw new IllegalStateException("No hay ningun job abierto en el editor");
      }
      Object process = processOf(editor);
      List<Map<String, Object>> nodes = new ArrayList<>();
      // `getGraphicalNodes` son los nodos del lienzo, que incluyen los que
      // no son nodos de proceso (los subjobs, por ejemplo).
      Object processNodes = process.getClass().getMethod("getGraphicalNodes").invoke(process);
      if (processNodes instanceof Iterable) {
        for (Object node : (Iterable<?>) processNodes) {
          nodes.add(nodeSummary(node));
        }
      }
      return nodes;
    });
  }

  // ---------------------------------------------------------------------
  // Acceso a la API de Talend
  // ---------------------------------------------------------------------

  /** Identificador unico con el formato que usa Talend. */
  private static String generateId() {
    return "_" + Long.toHexString(System.nanoTime());
  }

  /** Repositorio de Talend del proyecto abierto. */
  private static Object repositoryFactory() throws Exception {
    Object plugin = talendClass("org.talend.core.runtime.CoreRuntimePlugin")
        .getMethod("getInstance").invoke(null);
    return plugin.getClass().getMethod("getProxyRepositoryFactory").invoke(plugin);
  }

  /** Proyecto de Talend abierto. */
  private static Object currentProject() throws Exception {
    Class<?> projectManagerClass = talendClass("org.talend.repository.ProjectManager");
    Object projectManager = projectManagerClass.getMethod("getInstance").invoke(null);
    return projectManagerClass.getMethod("getCurrentProject").invoke(projectManager);
  }

  /**
   * Ruta de la carpeta del item para el repositorio.
   *
   * El repositorio antepone la carpeta del tipo de objeto (`process`) y crea
   * dentro los tres archivos del job: `.item`, `.properties` y `.screenshot`.
   * Por eso la ruta es solo el nombre de la carpeta, sin la carpeta `process`
   * y sin la extension.
   */
  private static org.eclipse.core.runtime.IPath processPath(String folder, String name, String version)
      throws Exception {
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

  /** Proyecto de Eclipse que corresponde al proyecto de Talend abierto. */
  private static IProject resourceProject() throws Exception {
    Class<?> projectManagerClass = talendClass("org.talend.repository.ProjectManager");
    Object projectManager = projectManagerClass.getMethod("getInstance").invoke(null);
    Object project = projectManagerClass.getMethod("getCurrentProject").invoke(projectManager);
    Object emfProject = project.getClass().getMethod("getEmfProject").invoke(project);
    return (IProject) projectManagerClass
        .getMethod("getResourceProject", talendClass("org.talend.core.model.properties.Project"))
        .invoke(projectManager, emfProject);
  }

  /**
   * Abre el job recien creado en el editor.
   *
   * Se abre por su ruta en disco, dentro del proyecto de Eclipse. El item
   * puede estar recien creado y el arbol de recursos de Eclipse todavia no lo
   * conoce, asi que antes se refresca el ancestro.
   */
  private static Map<String, Object> openCreatedJob(Object processItem, String name, String version)
      throws Exception {
    IProject iProject = resourceProject();
    if (iProject == null) {
      Map<String, Object> payload = new LinkedHashMap<>();
      payload.put("opened", false);
      payload.put("error", "No se pudo localizar el proyecto de Eclipse");
      return payload;
    }

    // El repositorio crea una carpeta por job, con los tres archivos dentro.
    org.eclipse.core.resources.IFolder jobFolder = iProject.getFolder("process").getFolder(name);
    jobFolder.refreshLocal(org.eclipse.core.resources.IResource.DEPTH_ZERO, null);
    org.eclipse.core.resources.IFile file = jobFolder.getFile(name + "_" + version + ".item");
    if (!file.exists()) {
      Map<String, Object> payload = new LinkedHashMap<>();
      payload.put("opened", false);
      payload.put("error", "El item recien creado no esta en el arbol de recursos");
      return payload;
    }

    return WorkbenchService.openResource(file.getLocation().toOSString());
  }

  /** Editor grafico del job abierto. */
  private static Object designerEditor() throws Exception {    org.eclipse.ui.IEditorPart editor = WorkbenchService.activeEditorPart();
    if (editor == null) {
      return null;
    }
    Object designer = editor.getClass().getMethod("getDesignerEditor").invoke(editor);
    return designer != null ? designer : editor;
  }

  /** Proceso (job) abierto en el editor. */
  private static Object processOf(Object editor) throws Exception {
    Object process = editor.getClass().getMethod("getProcess").invoke(editor);
    if (process == null) {
      throw new IllegalStateException("El editor no tiene un proceso cargado");
    }
    return process;
  }

  /** Parte grafica de un nodo, que es lo que guarda el portapapeles. */
  private static Object nodePartOf(Object editor, Object node) throws Exception {
    Object viewer = editor.getClass().getMethod("getViewer").invoke(editor);
    if (viewer == null) {
      return null;
    }
    Object parts = viewer.getClass().getMethod("getEditParts").invoke(viewer);
    if (parts instanceof Iterable) {
      for (Object part : (Iterable<?>) parts) {
        Object model = part.getClass().getMethod("getModel").invoke(part);
        if (model == node) {
          return part;
        }
      }
    }
    return null;
  }

  /** Nodo del proceso por su unique name. */
  private static Object nodeByUniqueName(Object process, String uniqueName) throws Exception {
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

  /** Aplica los parametros que pide el usuario sobre los del componente. */
  private static void applyParameters(Object node, JsonObject spec) throws Exception {
    for (Map.Entry<String, JsonElement> entry : objectOf(spec, "parameters").entrySet()) {
      JsonElement raw = entry.getValue();
      if (!raw.isJsonObject()) {
        continue;
      }
      String value = string(raw.getAsJsonObject(), "value");
      if (value == null) {
        continue;
      }
      Object parameter = node.getClass().getMethod("getElementParameter", String.class)
          .invoke(node, entry.getKey());
      if (parameter == null) {
        // El componente no tiene ese parametro: se avisa, no se falla.
        BridgeLog.warn("El componente no tiene el parametro '" + entry.getKey() + "'");
        continue;
      }
      parameter.getClass().getMethod("setValue", Object.class).invoke(parameter, value);
    }
  }

  /**
   * Busca el componente en el catalogo de Talend.
   *
   * El catalogo vive en `IComponentsService`, que lo publica Talend.
   */
  private static Object findCatalogComponent(String componentName) throws Exception {
    Class<?> serviceClass = talendClass("org.talend.core.model.components.IComponentsService");
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

  private static Map<String, Object> nodeSummary(Object node) {
    Map<String, Object> summary = new LinkedHashMap<>();
    try {
      summary.put("uniqueName", node.getClass().getMethod("getUniqueName").invoke(node));
      summary.put("label", node.getClass().getMethod("getLabel").invoke(node));
      Object component = node.getClass().getMethod("getComponent").invoke(node);
      if (component != null) {
        summary.put("componentName", component.getClass().getMethod("getName").invoke(component));
      }
    } catch (Exception e) {
      // El resumen es informativo: si falla, no se rompe la operacion.
    }
    return summary;
  }

  // ---------------------------------------------------------------------
  // Utilidades
  // ---------------------------------------------------------------------

  private interface Operation {
    Object run() throws Exception;
  }

  private static Map<String, Object> run(String operation, Operation body) {
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("ok", true);
    payload.put("source", "studio-bridge");
    payload.put("confidence", "medium");
    payload.put("endpoint", "/automation/" + operation);
    try {
      Object result = body.run();
      payload.put("result", result);
    } catch (Exception e) {
      payload.put("ok", false);
      payload.put("error", "OPERATION_FAILED: " + describe(e));
      BridgeLog.warn("La operacion '" + operation + "' fallo", e);
    }
    return payload;
  }

  private static String connectorOf(JsonObject spec) {
    String connector = string(spec, "type");
    if (connector == null || connector.trim().isEmpty()) {
      connector = "FLOW";
    }
    return connector;
  }

  private static Point positionOf(JsonObject spec) {
    JsonObject position = objectOf(spec, "position");
    int x = position.has("x") ? position.get("x").getAsInt() : 128;
    int y = position.has("y") ? position.get("y").getAsInt() : 128;
    return new Point(x, y);
  }

  private static String required(JsonObject spec, String key) {
    String value = string(spec, key);
    if (value == null || value.trim().isEmpty()) {
      throw new IllegalArgumentException("Falta el parametro '" + key + "'");
    }
    return value;
  }

  private static String string(JsonObject object, String key) {
    if (object == null || !object.has(key) || object.get(key).isJsonNull()) {
      return null;
    }
    return object.get(key).getAsString();
  }

  private static JsonObject objectOf(JsonObject parent, String key) {
    if (parent == null || !parent.has(key) || !parent.get(key).isJsonObject()) {
      return new JsonObject();
    }
    return parent.getAsJsonObject(key);
  }

  private static List<String> stringList(JsonObject parent, String key) {
    List<String> items = new ArrayList<>();
    if (parent == null || !parent.has(key) || !parent.get(key).isJsonArray()) {
      return items;
    }
    for (JsonElement element : parent.getAsJsonArray(key)) {
      if (element.isJsonPrimitive()) {
        items.add(element.getAsString());
      }
    }
    return items;
  }

  private static Class<?> talendClass(String className) throws ClassNotFoundException {
    org.osgi.framework.BundleContext context =
        org.eclipse.core.runtime.Platform.getBundle("org.talend.core.runtime").getBundleContext();
    for (org.osgi.framework.Bundle bundle : context.getBundles()) {
      try {
        return bundle.loadClass(className);
      } catch (ClassNotFoundException ignored) {
        // El bundle no tiene la clase: se prueba el siguiente.
      }
    }
    return Class.forName(className);
  }

  private static String describe(Exception e) {
    Throwable cause = e;
    while (cause.getCause() != null && cause.getCause() != cause) {
      cause = cause.getCause();
    }
    return cause.getMessage() != null ? cause.getMessage() : cause.toString();
  }
}
