package com.andres.talend.bridge.automation;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import com.andres.talend.bridge.BridgeLog;
import com.andres.talend.bridge.UiThread;
import com.google.gson.JsonObject;
import org.eclipse.gef.commands.Command;

/** Operaciones de conexiones del modelo de jobs de Talend. */
final class NodeConnectionOperations {
  private NodeConnectionOperations() {}

  private static <T> T onUi(java.util.concurrent.Callable<T> action) {
    return UiThread.sync(action);
  }

  static Map<String, Object> connect(JsonObject spec) throws Exception {
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
    // El nombre se calcula una sola vez: para un flujo, cada llamada busca el
    // siguiente `rowN` libre, y pedirlo dos veces deja la conexion con un
    // nombre y el estilo aplicado a otro.
    String nombreConexion = ConnectionNaming.connectionNameOf(spec, process, target);
    meta.add(sourceName);
    meta.add(nombreConexion);
    meta.add(null);

    Class<?> commandClass = TalendClasses
        .load("org.talend.designer.core.ui.editor.cmd.ConnectionCreateCommand");
    // El conector va con el nombre del catalogo (`SUBJOB_OK`, `COMPONENT_OK`):
    // es el que existe en la lista de conectores del nodo. `OnSubjobOk` es la
    // etiqueta de la conexion, no el conector, y con ella el comando falla
    // (`nodeConnectorSource is null`) y la linea queda como flujo de datos.
    String conector = ConnectionNaming.connectorOf(spec);
    boolean trigger = ConnectionNaming.isTriggerConnector(conector);
    Object command = commandClass
        .getConstructor(TalendClasses.load("org.talend.designer.core.ui.editor.nodes.Node"),
            String.class, List.class)
        .newInstance(source, conector, meta);
    commandClass.getMethod("setTarget", TalendClasses.load("org.talend.designer.core.ui.editor.nodes.Node"))
        .invoke(command, target);
    // La conexion se ejecuta por el command stack, igual que cuando se
    // arrastra con el raton. Si se llama a `execute()` directamente el
    // editor no se marca como modificado y el guardado se salta la
    // conexion.
    //
    // El `commandStack` mira `canExecute()` antes de ejecutar, y si el
    // comando dice que no, **no hace nada y no avisa**. Por eso se comprueba
    // antes: un trigger de subjob solo puede apuntar a un componente que
    // pueda arrancar su propio subjob.
    Object puedeEjecutar = commandClass.getMethod("canExecute").invoke(command);
    if (!Boolean.TRUE.equals(puedeEjecutar)) {
      throw new IllegalStateException("Studio rechaza la conexion " + sourceName + " -> " + targetName
          + " con el conector " + conector + ":"
          + (trigger
              ? " el destino no puede arrancar un subjob propio (un trigger solo apunta a un componente de"
                  + " arranque; si el destino necesita entrada, el trigger va al arranque de ese subjob)"
              : " revisa que el conector exista en el origen y que el destino lo acepte"));
    }
    Object commandStack = editor.getClass().getMethod("getCommandStack").invoke(editor);
    commandStack.getClass().getMethod("execute", Command.class).invoke(commandStack, command);
    if (trigger) {
      // El comando deberia dejar el estilo del trigger, pero se fija aqui
      // igualmente: una linea de trigger marcada como flujo hace que el
      // generador copie la fila del origen en un struct del destino sin
      // columnas y el job no compila.
      setConnectionType(target, nombreConexion, conector);
    }
    if (!conectado(target, nombreConexion)) {
      throw new IllegalStateException("Studio acepto la conexion " + sourceName + " -> " + targetName
          + " pero no la dejo en el modelo; el job se guardaria sin ella");
    }
    TalendApi.markModified(process);
    JobPersistence.persist(process);

    Map<String, Object> result = new LinkedHashMap<>();
    result.put("source", sourceName);
    result.put("target", targetName);
    result.put("connector", ConnectionNaming.connectorOf(spec));
    if (trigger && !esArranqueDeSubjob(source)) {
      // Studio genera la llamada al destino de un trigger dentro del metodo
      // del **primer** componente del subjob. Si la conexion sale de un
      // componente de en medio del flujo, la conexion se guarda pero el
      // generador no la emite y el destino no se ejecuta nunca.
      result.put("warnings", List.of(
          "El trigger sale de '" + sourceName + "', que no es el primer componente del subjob:"
              + " Studio lo guarda pero no genera la llamada, asi que '" + targetName
              + "' no se ejecutaria. Conectalo desde el arranque del subjob."));
    }
    return result;
  }
  private static boolean esArranqueDeSubjob(Object node) {
    Object valor = TalendApi.invokeOrNull(node, "isDesignSubjobStartNode");
    return Boolean.TRUE.equals(valor);
  }

  /**
   * Si el nodo destino ya tiene esa conexion entrante.
   *
   * El command stack no avisa cuando se salta un comando que no puede
   * ejecutar, asi que despues de conectar se comprueba en el modelo.
   */
  private static boolean conectado(Object target, String nombre) {
    Object conexiones = TalendApi.invokeOrNull(target, "getIncomingConnections");
    if (!(conexiones instanceof Iterable)) {
      return false;
    }
    for (Object conexion : (Iterable<?>) conexiones) {
      Object actual = TalendApi.invokeOrNull(conexion, "getName");
      if (actual != null && nombre.equals(String.valueOf(actual))) {
        return true;
      }
    }
    return false;
  }

  /**
   * Deja la conexion con el estilo de linea que le corresponde.
   *
   * El comando ya crea la conexion con el conector del catalogo, pero el
   * estilo de la linea se fija aqui como red de seguridad: una conexion de
   * trigger marcada como flujo hace que el generador copie la fila del origen
   * en un struct del destino sin columnas. Los estilos son los del IDE: 0
   * flujo, 1 OnSubjobOk, 2 OnSubjobError, 3 OnComponentOk, 4 OnComponentError,
   * 6 If, 7 Iterate.
   */
  private static void setConnectionType(Object target, String connectionName, String connector) {
    String tipo = switch (connector) {
      case "OnSubjobOk", "SUBJOB_OK" -> "ON_SUBJOB_OK";
      case "OnSubjobError", "SUBJOB_ERROR" -> "ON_SUBJOB_ERROR";
      case "OnComponentOk", "COMPONENT_OK" -> "ON_COMPONENT_OK";
      case "OnComponentError", "COMPONENT_ERROR" -> "ON_COMPONENT_ERROR";
      case "OnRowsEnd", "ROWS_END" -> "ON_ROWS_END";
      case "If", "RUN_IF" -> "RUN_IF";
      case "Iterate", "ITERATE" -> "ITERATE";
      case "Reject", "REJECT" -> "REJECT";
      default -> "FLOW_MAIN";
    };
    Object conexiones;
    try {
      conexiones = target.getClass().getMethod("getIncomingConnections").invoke(target);
    } catch (Exception e) {
      return;
    }
    if (!(conexiones instanceof Iterable)) {
      return;
    }
    Class<?> clase;
    try {
      clase = TalendClasses.load("org.talend.core.model.process.EConnectionType");
    } catch (Exception e) {
      return;
    }
    Object valor = null;
    for (Object candidato : clase.getEnumConstants()) {
      if (tipo.equals(((Enum<?>) candidato).name())) {
        valor = candidato;
      }
    }
    if (valor == null) {
      return;
    }
    for (Object conexion : (Iterable<?>) conexiones) {
      Object nombre = TalendApi.invokeOrNull(conexion, "getName");
      if (nombre == null || !connectionName.equals(String.valueOf(nombre))) {
        continue;
      }
      // Solo el estilo: el `connectorName` ya lo pone el comando con el
      // nombre del catalogo (`SUBJOB_OK`). Renombrarlo a `OnSubjobOk` deja la
      // conexion apuntando a un conector que no existe en el nodo origen, y
      // ademas revienta la figura de la linea.
      try {
        conexion.getClass().getMethod("setLineStyle", clase).invoke(conexion, valor);
      } catch (Exception e) {
        BridgeLog.warn("No se pudo tipar la conexion " + connector, e);
      }
    }
  }
}

