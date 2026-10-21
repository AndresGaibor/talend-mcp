package com.andres.talend.bridge.automation;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import com.andres.talend.bridge.BridgeLog;

import com.google.gson.JsonObject;

import org.eclipse.draw2d.geometry.Point;
import org.eclipse.gef.commands.Command;

/**
 * Alta, edicion y borrado de los componentes de un job.
 *
 * Los comandos son los mismos que usa el editor de Talend: `CreateRequest`
 * para anadir un nodo, `ConnectionCreateCommand` para conectar y
 * `DeleteNodeContainerCommand` para borrar. Asi cada nodo nace con todos sus
 * parametros y valores por defecto.
 *
 * Las operaciones van por el command stack: si se ejecutan a mano, el editor
 * no se marca como modificado y el guardado se salta los cambios.
 */
public final class NodeOperations {

  private NodeOperations() {}

  /**
   * Anade un componente al job abierto.
   *
   * @param spec type, label, position y la configuracion declarativa.
   */
  public static Map<String, Object> add(JsonObject spec) throws Exception {
    Object editor = TalendApi.designerEditor(spec);
    String componentName = JsonSpec.required(spec, "type");
    Object catalogComponent = TalendApi.findCatalogComponent(componentName);
    if (catalogComponent == null) {
      throw new IllegalStateException(
          "Componente '" + componentName + "' no encontrado en el catalogo de Talend");
    }

    // Node(component) es lo que hace el palette de Studio al soltar el
    // componente: crea el nodo con la definicion del componente.
    Class<?> nodeClass = TalendClasses.load("org.talend.designer.core.ui.editor.nodes.Node");
    Object node = nodeClass
        .getConstructor(TalendClasses.load("org.talend.core.model.components.IComponent"))
        .newInstance(catalogComponent);

    // El nodo nace sin parametros: hay que pedirle al componente que los
    // cree. Es lo que hace el editor al soltar el componente en el lienzo, y
    // es de donde salen los valores por defecto (ENCODING, FIELDSEPARATOR,
    // el schema fijo de tFixedFlowInput...).
    createComponentParameters(nodeClass, node);

    Object process = TalendApi.processOf(editor);

    // El nombre unico lo genera el proceso. El comando de alta solo lo
    // registra: si el parametro UNIQUE_NAME se queda vacio, el nodo no se
    // serializa y no se puede referenciar en una conexion.
    assignUniqueName(process, node);

    // El nodo entra en el proceso dentro de un NodeContainer, que es lo que
    // hace el comando de alta del editor.
    Class<?> containerClass = TalendClasses
        .load("org.talend.designer.core.ui.editor.nodecontainer.NodeContainer");
    Object nodeContainer = containerClass.getConstructor(nodeClass).newInstance(node);

    Class<?> commandClass = TalendClasses
        .load("org.talend.designer.core.ui.editor.cmd.CreateNodeContainerCommand");
    Command command = (Command) commandClass
        .getConstructor(TalendClasses.load("org.talend.designer.core.ui.editor.process.Process"),
            containerClass, Point.class)
        .newInstance(process, nodeContainer, positionOf(spec));

    // El command stack es quien registra el nodo en el modelo y lo dibuja.
    Object commandStack = editor.getClass().getMethod("getCommandStack").invoke(editor);
    commandStack.getClass().getMethod("execute", Command.class).invoke(commandStack, command);

    // La configuracion del componente es declarativa: parametros, tablas,
    // schema y modelo propio. El nucleo no conoce ningun componente
    // concreto, asi que anadir soporte para uno nuevo es anadir un
    // adaptador, no tocar esta clase.
    ComponentConfigurator.configure(node, spec);

    String label = JsonSpec.string(spec, "label");
    if (label != null) {
      node.getClass().getMethod("setLabel", String.class).invoke(node, label);
    }
    TalendApi.markModified(process);
    JobPersistence.persist(process);
    return summary(node);
  }

  /**
   * Configura un componente ya anadido.
   *
   * @param spec uniqueName del nodo y la configuracion.
   */
  public static Map<String, Object> configure(JsonObject spec) throws Exception {
    Object editor = TalendApi.designerEditor(spec);
    Object process = TalendApi.processOf(editor);
    String uniqueName = JsonSpec.required(spec, "uniqueName");
    Object node = TalendApi.nodeByUniqueName(process, uniqueName);
    if (node == null) {
      throw new IllegalStateException("No existe el nodo '" + uniqueName + "'");
    }
    ComponentConfigurator.configure(node, spec);
    TalendApi.markModified(process);
    JobPersistence.persist(process);
    return summary(node);
  }

  /**
   * Conecta dos nodos del job abierto.
   *
   * @param spec source, target, type y name.
   */
  public static Map<String, Object> connect(JsonObject spec) throws Exception {
    Object editor = TalendApi.designerEditor(spec);
    Object process = TalendApi.processOf(editor);
    String sourceName = JsonSpec.required(spec, "source");
    String targetName = JsonSpec.required(spec, "target");

    Object source = TalendApi.nodeByUniqueName(process, sourceName);
    Object target = TalendApi.nodeByUniqueName(process, targetName);
    if (source == null) {
      throw new IllegalStateException("No existe el nodo origen '" + sourceName + "'");
    }
    if (target == null) {
      throw new IllegalStateException("No existe el nodo destino '" + targetName + "'");
    }

    // ConnectionCreateCommand es el comando que usa el editor al arrastrar
    // una conexion entre dos nodos.
    //
    // Su tercer argumento no es una lista cualquiera: el constructor lee
    // los tres primeros elementos sin comprobar nada, asi que la lista no
    // puede ir vacia. Son el nombre del schema de la conexion, el nombre de
    // la conexion y la metadata que viaja.
    List<Object> meta = new ArrayList<>();
    meta.add(sourceName);
    meta.add(connectionName(spec));
    meta.add(null);

    Class<?> commandClass = TalendClasses
        .load("org.talend.designer.core.ui.editor.cmd.ConnectionCreateCommand");
    Object command = commandClass
        .getConstructor(TalendClasses.load("org.talend.designer.core.ui.editor.nodes.Node"),
            String.class, List.class)
        .newInstance(source, connectorOf(spec), meta);
    commandClass.getMethod("setTarget", TalendClasses.load("org.talend.designer.core.ui.editor.nodes.Node"))
        .invoke(command, target);
    // La conexion se ejecuta por el command stack, igual que cuando se
    // arrastra con el raton. Si se llama a `execute()` directamente el
    // editor no se marca como modificado y el guardado se salta la
    // conexion.
    Object commandStack = editor.getClass().getMethod("getCommandStack").invoke(editor);
    commandStack.getClass().getMethod("execute", Command.class).invoke(commandStack, command);
    TalendApi.markModified(process);
    JobPersistence.persist(process);

    Map<String, Object> result = new LinkedHashMap<>();
    result.put("source", sourceName);
    result.put("target", targetName);
    result.put("connector", connectorOf(spec));
    return result;
  }

  /**
   * Cambia los parametros o la etiqueta de un nodo.
   *
   * @param spec uniqueName, label y parameters.
   */
  public static Map<String, Object> update(JsonObject spec) throws Exception {
    Object editor = TalendApi.designerEditor(spec);
    Object process = TalendApi.processOf(editor);
    String uniqueName = JsonSpec.required(spec, "uniqueName");
    Object node = TalendApi.nodeByUniqueName(process, uniqueName);
    if (node == null) {
      throw new IllegalStateException("No existe el nodo '" + uniqueName + "'");
    }
    ComponentConfigurator.configure(node, spec);
    String label = JsonSpec.string(spec, "label");
    if (label != null) {
      node.getClass().getMethod("setLabel", String.class).invoke(node, label);
    }
    TalendApi.markModified(process);
    JobPersistence.persist(process);
    return summary(node);
  }

  /**
   * Borra nodos del job abierto.
   *
   * @param spec uniqueNames de los nodos a borrar.
   */
  public static Map<String, Object> delete(JsonObject spec) throws Exception {
    Object editor = TalendApi.designerEditor(spec);
    Object process = TalendApi.processOf(editor);

    List<Object> nodes = new ArrayList<>();
    List<String> removed = new ArrayList<>();
    for (String uniqueName : JsonSpec.stringList(spec, "uniqueNames")) {
      Object node = TalendApi.nodeByUniqueName(process, uniqueName);
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
    Class<?> commandClass = TalendClasses
        .load("org.talend.designer.core.ui.editor.cmd.DeleteNodeContainerCommand");
    Object command = commandClass
        .getConstructor(TalendClasses.load("org.talend.core.model.process.IProcess2"), List.class)
        .newInstance(process, nodes);
    commandClass.getMethod("execute").invoke(command);

    Map<String, Object> result = new LinkedHashMap<>();
    result.put("removed", removed);
    return result;
  }

  /**
   * Copia un nodo del job abierto.
   *
   * @param spec uniqueName del nodo.
   */
  public static Map<String, Object> copy(JsonObject spec) throws Exception {
    Object editor = TalendApi.designerEditor(spec);
    Object process = TalendApi.processOf(editor);
    String uniqueName = JsonSpec.required(spec, "uniqueName");
    Object node = TalendApi.nodeByUniqueName(process, uniqueName);
    if (node == null) {
      throw new IllegalStateException("No existe el nodo '" + uniqueName + "'");
    }

    // NodesPasteCommand es el comando que usa el editor al copiar y pegar
    // un nodo.
    Class<?> commandClass = TalendClasses
        .load("org.talend.designer.core.ui.editor.cmd.NodesPasteCommand");
    // El comando de pegado trabaja con NodePart, no con el modelo. Se crea
    // la parte grafica del nodo original, que es lo que el portapapeles
    // guarda.
    Object nodePart = nodePartOf(editor, node);
    List<Object> parts = new ArrayList<>();
    parts.add(nodePart);
    Object command = commandClass
        .getConstructor(List.class, TalendClasses.load("org.talend.core.model.process.IProcess2"), Point.class)
        .newInstance(parts, process, positionOf(spec));
    commandClass.getMethod("execute").invoke(command);

    Map<String, Object> result = new LinkedHashMap<>();
    result.put("copied", uniqueName);
    return result;
  }

  /**
   * Lista los nodos del job abierto.
   */
  public static List<Map<String, Object>> list(JsonObject spec) throws Exception {
    Object editor = TalendApi.designerEditor(spec);
    Object process = TalendApi.processOf(editor);
    List<Map<String, Object>> nodes = new ArrayList<>();
    // `getGraphicalNodes` son los nodos del lienzo, que incluyen los que
    // no son nodos de proceso (los subjobs, por ejemplo).
    Object processNodes = process.getClass().getMethod("getGraphicalNodes").invoke(process);
    if (processNodes instanceof Iterable) {
      for (Object node : (Iterable<?>) processNodes) {
        nodes.add(summary(node));
      }
    }
    return nodes;
  }

  // ---------------------------------------------------------------------
  // Internos
  // ---------------------------------------------------------------------

  /**
   * Pone el nombre unico al nodo, que es el que usa Talend para nombrarlo.
   */
  private static void assignUniqueName(Object process, Object node) {
    try {
      Object parameter = node.getClass().getMethod("getElementParameter", String.class)
          .invoke(node, "UNIQUE_NAME");
      if (parameter == null) {
        BridgeLog.warn("El componente no tiene parametro UNIQUE_NAME");
        return;
      }
      Object current = parameter.getClass().getMethod("getValue").invoke(parameter);
      if (current != null && !String.valueOf(current).trim().isEmpty()) {
        return;
      }
      Object generated = process.getClass()
          .getMethod("generateUniqueNodeName", TalendClasses.load("org.talend.core.model.process.INode"))
          .invoke(process, node);
      if (generated == null) {
        return;
      }
      parameter.getClass().getMethod("setValue", Object.class)
          .invoke(parameter, String.valueOf(generated));
    } catch (Exception e) {
      BridgeLog.warn("No se pudo asignar el nombre unico al nodo", e);
    }
  }

  /**
   * Pide al componente que cree sus parametros.
   *
   * Un `Node` recien creado no tiene parametros: los crea el componente a
   * partir de su definicion. Sin este paso el nodo se queda sin `ENCODING`,
   * `FIELDSEPARATOR` y el schema fijo de los componentes que lo traen.
   *
   * El metodo no es publico, asi que se busca entre los declarados.
   */
  private static void createComponentParameters(Class<?> nodeClass, Object node) {
    try {
      java.lang.reflect.Method create = null;
      for (java.lang.reflect.Method method : nodeClass.getDeclaredMethods()) {
        if ("createElementParameters".equals(method.getName()) && method.getParameterCount() == 0) {
          create = method;
          break;
        }
      }
      if (create == null) {
        BridgeLog.warn("El nodo no tiene metodo para crear sus parametros");
        return;
      }
      create.setAccessible(true);
      create.invoke(node);
    } catch (Exception e) {
      BridgeLog.warn("No se pudieron crear los parametros del componente", e);
    }
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

  /** Resumen de un nodo, para la respuesta. */
  private static Map<String, Object> summary(Object node) {
    Map<String, Object> result = new LinkedHashMap<>();
    try {
      result.put("uniqueName", node.getClass().getMethod("getUniqueName").invoke(node));
      result.put("label", node.getClass().getMethod("getLabel").invoke(node));
      Object component = node.getClass().getMethod("getComponent").invoke(node);
      if (component != null) {
        result.put("componentName", component.getClass().getMethod("getName").invoke(component));
      }
    } catch (Exception e) {
      // El resumen es informativo: si falla, no se rompe la operacion.
    }
    return result;
  }

  /** Posicion del nodo en el lienzo. */
  private static Point positionOf(JsonObject spec) {
    JsonObject position = JsonSpec.objectOf(spec, "position");
    int x = position.has("x") ? position.get("x").getAsInt() : 128;
    int y = position.has("y") ? position.get("y").getAsInt() : 128;
    return new Point(x, y);
  }

  /** Nombre de la conexion, o uno por defecto. */
  private static String connectionName(JsonObject spec) {
    String name = JsonSpec.string(spec, "name");
    return name != null && !name.trim().isEmpty() ? name : "conn_1";
  }

  /** Tipo de conector de la conexion. */
  private static String connectorOf(JsonObject spec) {
    String connector = JsonSpec.string(spec, "type");
    if (connector == null || connector.trim().isEmpty()) {
      connector = "FLOW";
    }
    return connector;
  }
}
