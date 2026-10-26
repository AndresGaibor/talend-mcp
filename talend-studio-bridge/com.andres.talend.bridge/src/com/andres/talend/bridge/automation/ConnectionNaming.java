package com.andres.talend.bridge.automation;

import java.util.List;

import com.google.gson.JsonObject;

/** Nombres, conectores y numeracion de conexiones compatibles con Studio. */
final class ConnectionNaming {
  private ConnectionNaming() {}

  static String connectionNameOf(JsonObject spec, Object process, Object target) throws Exception {
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
  static boolean isTriggerConnector(String connector) {
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
  static String connectorOf(JsonObject spec) {
    String connector = JsonSpec.string(spec, "type");
    if (connector == null || connector.trim().isEmpty()) {
      connector = "FLOW";
    }
    return connector;
  }
}

