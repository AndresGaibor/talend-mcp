package com.andres.talend.bridge.automation;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import com.andres.talend.bridge.BridgeLog;

import com.google.gson.JsonObject;

/**
 * Guardado del modelo del job en el `.item`.
 *
 * `editor.doSave()` no sirve para esto: aborta en seco si el editor no esta
 * "dirty" y ese indicador mira el estado de la UI, no el del modelo de
 * Talend. Con los cambios que hace la API el editor queda limpio, asi que el
 * guardado no ocurre nunca.
 *
 * Ademas el `ProcessType` enlazado al recurso no es el que construye Talend:
 * las conexiones y el metadata viven en el modelo grafico y solo aparecen en
 * el `ProcessType` que arma `saveXmlFile()`. Por eso se toma ese resultado y
 * se deja como contenido del recurso.
 */
public final class JobPersistence {

  private JobPersistence() {}

  /**
   * Guarda el modelo del proceso en el `.item` del job.
   */
  public static void persist(Object process) {
    try {
      Object nuevo = process.getClass().getMethod("saveXmlFile").invoke(process);
      if (nuevo == null) {
        return;
      }
      Object item = itemOf(process);
      if (item == null) {
        BridgeLog.warn("El proceso no tiene item: no se puede guardar");
        return;
      }
      Object enlazado = item.getClass().getMethod("getProcess").invoke(item);
      if (enlazado == null) {
        BridgeLog.warn("El item no tiene ProcessType: no se puede guardar");
        return;
      }
      Object resource = enlazado.getClass().getMethod("eResource").invoke(enlazado);
      if (resource == null) {
        BridgeLog.warn("El job no esta enlazado a un recurso EMF: no se puede guardar");
        return;
      }

      // El ProcessType enlazado al recurso tiene los nodos (el modelo
      // grafico los va anadiendo ahi), pero no las conexiones ni el modelo
      // propio de los componentes (el del tMap): eso solo aparece en el
      // ProcessType que arma `saveXmlFile()`. Se sustituye el contenido del
      // recurso por ese, que es lo que se quiere guardar.
      @SuppressWarnings("unchecked")
      List<Object> contents = (List<Object>) resource.getClass()
          .getMethod("getContents").invoke(resource);
      contents.clear();
      contents.add(nuevo);
      item.getClass()
          .getMethod("setProcess", TalendClasses
              .load("org.talend.designer.core.model.utils.emf.talendfile.ProcessType"))
          .invoke(item, nuevo);

      // El modelo propio de un nodo (el `nodeData` del tMap) se copia en
      // profundidad: si no, el objeto sigue apuntando al recurso anterior y
      // no se escribe en el `.item`. Es el mismo truco que usa Studio.
      adoptNodeData(nuevo);

      resource.getClass().getMethod("save", Map.class).invoke(resource, new HashMap());
    } catch (Exception e) {
      BridgeLog.warn("No se pudo guardar el job en el .item", e);
    }
  }

  /**
   * Copia en profundidad el modelo propio de cada nodo.
   *
   * Sin la copia, el `nodeData` sigue enlazado al recurso anterior y el
   * `.item` sale sin el (las expresiones del tMap, por ejemplo).
   */
  private static void adoptNodeData(Object processType) throws Exception {
    Class<?> ecoreUtil = TalendClasses.load("org.eclipse.emf.ecore.util.EcoreUtil");
    // `EObject` es API restringida de EMF: se carga por nombre para no
    // atar el plugin a ella.
    Class<?> eobjectClass = TalendClasses.load("org.eclipse.emf.ecore.EObject");
    for (Object node : listOf(processType, "getNode")) {
      Object data = node.getClass().getMethod("getNodeData").invoke(node);
      if (data == null) {
        continue;
      }
      Object copy = ecoreUtil.getMethod("copy", eobjectClass).invoke(null, data);
      node.getClass()
          .getMethod("setNodeData", TalendClasses
              .load("org.talend.designer.core.model.utils.emf.talendfile.AbstractExternalData"))
          .invoke(node, copy);
    }
  }

  /** Lista de una caracteristica del ProcessType. */
  @SuppressWarnings("unchecked")
  private static List<Object> listOf(Object processType, String getter) throws Exception {
    return (List<Object>) processType.getClass().getMethod(getter).invoke(processType);
  }

  /** Item del repositorio al que pertenece el proceso. */
  private static Object itemOf(Object process) throws Exception {
    Object property = process.getClass().getMethod("getProperty").invoke(process);
    if (property == null) {
      return null;
    }
    return property.getClass().getMethod("getItem").invoke(property);
  }
}
