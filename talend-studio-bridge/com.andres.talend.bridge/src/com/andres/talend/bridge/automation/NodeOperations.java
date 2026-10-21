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
   * Ejecuta una operacion en el hilo de la interfaz de Studio.
   *
   * Todas las operaciones de nodos tocan el editor y el modelo EMF, asi que
   * tienen que ir en la UI. Y en trozos cortos: el bucle que recorre el
   * catalogo llama a esta clase componente a componente, en vez de meter el
   * bucle entero en la UI (que congelaria Studio).
   */
  private static <T> T onUi(java.util.concurrent.Callable<T> action) {
    return com.andres.talend.bridge.UiThread.sync(action);
  }

  /**
   * Anade un componente al job abierto.
   *
   * @param spec type, label, position y la configuracion declarativa.
   */
  public static Map<String, Object> add(JsonObject spec) throws Exception {
    return onUi(() -> addOnUi(spec));
  }

  private static Map<String, Object> addOnUi(JsonObject spec) throws Exception {
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
    Object node = createNode(nodeClass, catalogComponent);

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
        .newInstance(process, nodeContainer, positionFor(spec, process));

    // El command stack es quien registra el nodo en el modelo y lo dibuja.
    Object commandStack = editor.getClass().getMethod("getCommandStack").invoke(editor);
    commandStack.getClass().getMethod("execute", Command.class).invoke(commandStack, command);

    // GEF ignora en silencio un comando que no se puede ejecutar (por ejemplo
    // porque la posicion esta ocupada) y el nodo no llega a entrar. Sin esta
    // comprobacion el alta respondia "ok" con un nombre que no existe.
    String assigned = String.valueOf(node.getClass().getMethod("getUniqueName").invoke(node));
    if (TalendApi.nodeByUniqueName(process, assigned) == null) {
      throw new IllegalStateException("Studio rechazo el alta de '" + componentName
          + "': el nodo no esta en el job (posicion ocupada o job de solo lectura)");
    }

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
    boolean saved = JobPersistence.persist(process);
    Map<String, Object> added = summary(node);
    // Si Studio no pudo guardar el job con este nodo, el nodo esta en memoria
    // pero no en el .item: quien llama debe saberlo.
    added.put("saved", saved);
    return added;
  }

  /**
   * Configura un componente ya anadido.
   *
   * @param spec uniqueName del nodo y la configuracion.
   */
  public static Map<String, Object> configure(JsonObject spec) throws Exception {
    return onUi(() -> configureOnUi(spec));
  }

  private static Map<String, Object> configureOnUi(JsonObject spec) throws Exception {
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
   * Conecta dos nodos del job abierto.
   *
   * @param spec source, target, type y name.
   */
  public static Map<String, Object> connect(JsonObject spec) throws Exception {
    return onUi(() -> connectOnUi(spec));
  }

  private static Map<String, Object> connectOnUi(JsonObject spec) throws Exception {
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
    meta.add(connectionNameOf(spec, process, target));
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
    return onUi(() -> updateOnUi(spec));
  }

  private static Map<String, Object> updateOnUi(JsonObject spec) throws Exception {
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
    return onUi(() -> deleteOnUi(spec));
  }

  private static Map<String, Object> deleteOnUi(JsonObject spec) throws Exception {
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
    return onUi(() -> copyOnUi(spec));
  }

  private static Map<String, Object> copyOnUi(JsonObject spec) throws Exception {
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
    return onUi(() -> listOnUi(spec));
  }

  private static List<Map<String, Object>> listOnUi(JsonObject spec) throws Exception {
    Object editor = TalendApi.designerEditor(spec);
    Object process = TalendApi.processOf(editor);
    List<Map<String, Object>> nodes = new ArrayList<>();
    // Se listan todos los contenedores, no solo los del lienzo: los nodos de
    // conexion (tDBConnection, tFTPConnection) no aparecen en el lienzo pero
    // forman parte del job.
    for (Object node : TalendApi.allNodes(process)) {
      nodes.add(summary(node));
    }
    return nodes;
  }

  /**
   * Codigos de columna de una tabla de un nodo.
   *
   * La tabla del nodo puede tener mas columnas que las que declara el XML
   * (la `FORMATS` del tFileOutputPositional anade `SCHEMA_COLUMN`), asi que
   * las filas se tienen que alinear con las del nodo, no con las del XML.
   *
   * @param spec uniqueName del nodo y `table` (nombre de la tabla).
   */
  public static List<String> tableColumns(JsonObject spec) throws Exception {
    return onUi(() -> {
      Object editor = TalendApi.designerEditor(spec);
      Object process = TalendApi.processOf(editor);
      String uniqueName = JsonSpec.required(spec, "uniqueName");
      Object node = TalendApi.nodeByUniqueName(process, uniqueName);
      if (node == null) {
        throw new IllegalStateException("No existe el nodo '" + uniqueName + "'");
      }
      String tableName = JsonSpec.required(spec, "table");
      Object parameter = node.getClass().getMethod("getElementParameter", String.class)
          .invoke(node, tableName);
      List<String> codes = new ArrayList<>();
      if (parameter == null) {
        return codes;
      }
      Object raw = parameter.getClass().getMethod("getListItemsDisplayCodeName").invoke(parameter);
      if (raw instanceof Object[]) {
        for (Object code : (Object[]) raw) {
          codes.add(String.valueOf(code));
        }
      }
      return codes;
    });
  }

  /**
   * Tablas (metadata) que el nodo ya trae.
   *
   * Los componentes con schema fijo (el tFileOutputRaw, que solo escribe una
   * columna "content") crean su metadata al nacer: si no se le da al origen el
   * mismo schema, el codigo generado no compila ("content cannot be
   * resolved or is not a field").
   *
   * @param spec uniqueName del nodo.
   */
  public static List<Map<String, Object>> schemaOf(JsonObject spec) throws Exception {
    return onUi(() -> schemaOnUi(spec));
  }

  private static List<Map<String, Object>> schemaOnUi(JsonObject spec) throws Exception {
    Object editor = TalendApi.designerEditor(spec);
    Object process = TalendApi.processOf(editor);
    String uniqueName = JsonSpec.required(spec, "uniqueName");
    Object node = TalendApi.nodeByUniqueName(process, uniqueName);
    if (node == null) {
      throw new IllegalStateException("No existe el nodo '" + uniqueName + "'");
    }
    List<Map<String, Object>> tables = new ArrayList<>();
    Object metadata = node.getClass().getMethod("getMetadataList").invoke(node);
    if (!(metadata instanceof Iterable)) {
      return tables;
    }
    for (Object table : (Iterable<?>) metadata) {
      Map<String, Object> item = new LinkedHashMap<>();
      Object connector = table.getClass().getMethod("getAttachedConnector").invoke(table);
      item.put("connector", connector == null ? "FLOW" : String.valueOf(connector));
      Object name = table.getClass().getMethod("getTableName").invoke(table);
      item.put("name", name == null ? "" : String.valueOf(name));
      List<Map<String, Object>> columns = new ArrayList<>();
      Object list = table.getClass().getMethod("getListColumns").invoke(table);
      if (list instanceof Iterable) {
        for (Object column : (Iterable<?>) list) {
          Map<String, Object> columnItem = new LinkedHashMap<>();
          Object label = column.getClass().getMethod("getLabel").invoke(column);
          columnItem.put("name", label == null ? "" : String.valueOf(label));
          Object type = column.getClass().getMethod("getType").invoke(column);
          columnItem.put("type", type == null ? "id_String" : String.valueOf(type));
          columns.add(columnItem);
        }
      }
      item.put("columns", columns);
      tables.add(item);
    }
    return tables;
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

  /**
   * Node(component): lo que hace el palette de Studio al soltar el componente.
   * Si el constructor falla, el error de Studio se propaga con su causa real.
   */
  private static Object createNode(Class<?> nodeClass, Object catalogComponent) throws Exception {
    return nodeClass
        .getConstructor(TalendClasses.load("org.talend.core.model.components.IComponent"))
        .newInstance(catalogComponent);
  }

  /** Separacion de la rejilla de colocacion automatica, en pixeles. */
  private static final int GRID_X = 200;
  private static final int GRID_Y = 120;
  private static final int GRID_COLUMNS = 6;

  /**
   * Posicion del nodo: la pedida, o el primer hueco libre de la rejilla.
   *
   * Studio descarta el nodo cuando cae sobre otro, asi que sin posicion
   * explicita no vale un valor fijo: cada alta buscaria el mismo sitio.
   */
  private static Point positionFor(JsonObject spec, Object process) throws Exception {
    JsonObject position = JsonSpec.objectOf(spec, "position");
    if (position.has("x") || position.has("y")) {
      return positionOf(spec);
    }

    List<Point> taken = new ArrayList<>();
    for (Object existing : TalendApi.allNodes(process)) {
      Object location = TalendApi.invokeOrNull(existing, "getLocation");
      if (location instanceof Point) {
        taken.add((Point) location);
      }
    }

    for (int index = 0; index < 400; index++) {
      Point candidate = new Point(128 + (index % GRID_COLUMNS) * GRID_X, 128 + (index / GRID_COLUMNS) * GRID_Y);
      boolean free = true;
      for (Point other : taken) {
        if (Math.abs(other.x - candidate.x) < GRID_X / 2 && Math.abs(other.y - candidate.y) < GRID_Y / 2) {
          free = false;
          break;
        }
      }
      if (free) {
        return candidate;
      }
    }
    return positionOf(spec);
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

  /**
   * Nombre de la conexion, con la convencion de Studio.
   *
   * El flujo principal se llama `row1`, `row2`... y los triggers tienen su
   * propio nombre (`OnComponentOk`, `If`, `Iterate`...). No es cosmetico: el
   * generador busca las columnas de entrada por el nombre de la conexion, y
   * una tabla como la del `tAggregateRow` las referencia como "row1.monto".
   * Con otro nombre, el codigo no se genera ("inputColumn is null").
   *
   * La numeracion es del **job**, no del nodo: el `tUniqRow` libera la fila de
   * su conexion de salida (`<salida> = null;`) antes de leer la de entrada, y
   * si las dos se llaman igual, el codigo generado lee una variable nula.
   */
  private static String connectionNameOf(JsonObject spec, Object process, Object target) throws Exception {
    String name = JsonSpec.string(spec, "name");
    if (name != null && !name.trim().isEmpty()) {
      return name;
    }
    String connector = connectorOf(spec);
    if (isTriggerConnector(connector)) {
      return triggerName(connector);
    }
    // Cualquier conexion de datos (FLOW, UNIQUE, DUPLICATE, REJECT...) se
    // llama rowN: ese nombre es la variable de la fila en el codigo
    // generado, y las tablas de los componentes la referencian ("row1.monto").
    return uniqueFlowName(process);
  }

  /** Los triggers (OnComponentOk, If...) no son conexiones de datos. */
  private static boolean isTriggerConnector(String connector) {
    if (connector == null) {
      return false;
    }
    switch (connector.toUpperCase()) {
      case "SUBJOB_OK":
      case "SUBJOB_ERROR":
      case "COMPONENT_OK":
      case "COMPONENT_ERROR":
      case "RUN_IF":
        return true;
      default:
        return false;
    }
  }

  /**
   * Nombre libre para una conexion de flujo.
   *
   * Studio genera ese nombre con `IProcess.generateUniqueConnectionName()`,
   * que es el mismo que usa el IDE: `row1`, `row2`... Se recurre a contarlas
   * si el metodo no esta disponible.
   */
  private static String uniqueFlowName(Object process) throws Exception {
    String name = "row" + (flowConnectionsOf(process) + 1);
    // Por si el nombre ya esta pillado (el IDE tambien lo comprueba).
    for (int intento = 0; intento < 50; intento++) {
      if (!connectionNameExists(process, name)) {
        return name;
      }
      name = "row" + (flowConnectionsOf(process) + intento + 2);
    }
    return name;
  }

  /** Si el job ya tiene una conexion con ese nombre. */
  private static boolean connectionNameExists(Object process, String name) throws Exception {
    for (Object node : TalendApi.allNodes(process)) {
      try {
        Object outgoing = node.getClass().getMethod("getOutgoingConnections").invoke(node);
        if (!(outgoing instanceof Iterable)) {
          continue;
        }
        for (Object connection : (Iterable<?>) outgoing) {
          Object connectionName = connection.getClass().getMethod("getName").invoke(connection);
          if (name.equals(String.valueOf(connectionName))) {
            return true;
          }
        }
      } catch (Exception e) {
        // Sin informacion: se asume que no existe.
      }
    }
    return false;
  }

  /** Nombre que Studio da a cada tipo de trigger. */
  private static String triggerName(String connector) {
    switch (connector == null ? "" : connector.toUpperCase()) {
      case "COMPONENT_OK":
        return "OnComponentOk";
      case "COMPONENT_ERROR":
        return "OnComponentError";
      case "SUBJOB_OK":
        return "OnSubjobOk";
      case "SUBJOB_ERROR":
        return "OnSubjobError";
      case "RUN_IF":
        return "If";
      case "ITERATE":
        return "Iterate";
      case "REJECT":
        return "reject1";
      default:
        return "conn_1";
    }
  }

  /** Cuantas conexiones de datos tiene ya el job. */
  private static int flowConnectionsOf(Object process) throws Exception {
    int count = 0;
    for (Object node : TalendApi.allNodes(process)) {
      try {
        Object outgoing = node.getClass().getMethod("getOutgoingConnections").invoke(node);
        if (!(outgoing instanceof Iterable)) {
          continue;
        }
        for (Object connection : (Iterable<?>) outgoing) {
          Object connectorName = connection.getClass().getMethod("getConnectorName").invoke(connection);
          if (!isTriggerConnector(String.valueOf(connectorName))) {
            count++;
          }
        }
      } catch (Exception e) {
        // El nodo no expone sus conexiones: se cuenta lo que se pueda.
      }
    }
    return count;
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
