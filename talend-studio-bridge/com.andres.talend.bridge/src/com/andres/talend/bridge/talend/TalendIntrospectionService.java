package com.andres.talend.bridge.talend;

import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.eclipse.ui.IEditorPart;
import org.eclipse.ui.IWorkbenchPage;
import org.eclipse.ui.IWorkbenchWindow;
import org.eclipse.ui.PlatformUI;

public final class TalendIntrospectionService {
  private TalendIntrospectionService() {}

  public static Map<String, Object> activeEditorIntrospect() {
    IWorkbenchPage page = activePage();
    IEditorPart editor = page != null ? page.getActiveEditor() : null;
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("ok", true);
    payload.put("source", "studio-bridge");
    payload.put("confidence", editor != null ? "high" : "low");
    payload.put("endpoint", "/talend/active-editor/introspect");
    payload.put("activeEditor", editor == null ? null : editorSummary(editor));
    payload.put("methods", editor == null ? new ArrayList<String>() : methodNames(editor.getClass()));
    Map<String, Object> process = new LinkedHashMap<>();
    process.put("available", hasMethod(editor, "getProcess") || hasMethod(editor, "getProcessItem"));
    process.put("class", editor != null ? editor.getClass().getName() : null);
    process.put("methods", editor == null ? new ArrayList<String>() : methodNames(editor.getClass()));
    Map<String, Object> talendObjects = new LinkedHashMap<>();
    talendObjects.put("process", process);
    payload.put("talendObjects", talendObjects);
    return payload;
  }

  public static Map<String, Object> activeJobModel() {
    IWorkbenchPage page = activePage();
    IEditorPart editor = page != null ? page.getActiveEditor() : null;
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("ok", true);
    payload.put("source", "studio-bridge");
    payload.put("confidence", editor != null ? "medium" : "low");
    payload.put("endpoint", "/talend/active-job/model");

    if (editor == null) {
      List<String> unsupported = new ArrayList<>();
      unsupported.add("No hay editor activo");
      payload.put("unsupported", unsupported);
      return payload;
    }

    Object process = invokeFirst(editor, "getProcess", "getProcessItem");
    if (process == null) {
      List<String> unsupported = new ArrayList<>();
      unsupported.add("El editor activo no expone getProcess/getProcessItem");
      payload.put("unsupported", unsupported);
      payload.put("activeEditor", editorSummary(editor));
      return payload;
    }

    payload.put("activeEditor", editorSummary(editor));
    List<String> jobMethods = new ArrayList<>();
    jobMethods.add("getLabel");
    jobMethods.add("getName");
    jobMethods.add("getVersion");
    payload.put("job", inspectObject(process, jobMethods));
    Object nodes = invokeFirst(process, "getGraphicalNodes", "getNodes");
    List<Map<String, Object>> components = inspectCollection(nodes);
    List<Map<String, Object>> connections = inspectCollection(invokeFirst(process, "getConnections"));
    if (connections.isEmpty()) {
      connections = inspectConnectionsFromNodes(nodes);
    }
    payload.put("components", components);
    payload.put("connections", connections);
    payload.put("unsupported", collectUnsupported(nodes, connections));
    return payload;
  }

  private static IWorkbenchPage activePage() {
    IWorkbenchWindow window = PlatformUI.getWorkbench().getActiveWorkbenchWindow();
    return window != null ? window.getActivePage() : null;
  }

  private static Map<String, Object> editorSummary(IEditorPart editor) {
    Map<String, Object> item = new LinkedHashMap<>();
    item.put("title", editor.getTitle());
    item.put("class", editor.getClass().getName());
    item.put("dirty", editor.isDirty());
    return item;
  }

  private static List<String> methodNames(Class<?> type) {
    List<String> methods = new ArrayList<>();
    for (Method method : type.getMethods()) {
      methods.add(method.getName());
    }
    return methods;
  }

  private static boolean hasMethod(Object value, String name) {
    return value != null && invoke(value, name) != null;
  }

  private static Object invokeFirst(Object value, String... names) {
    if (value == null) return null;
    for (String name : names) {
      Object result = invoke(value, name);
      if (result != null) return result;
    }
    return null;
  }

  private static Object invoke(Object value, String name) {
    try {
      Method method = value.getClass().getMethod(name);
      return method.invoke(value);
    } catch (Exception ignored) {
      return null;
    }
  }

  private static Map<String, Object> inspectObject(Object value, List<String> methodNames) {
    Map<String, Object> item = new LinkedHashMap<>();
    if (value == null) {
      item.put("available", false);
      return item;
    }

    item.put("available", true);
    item.put("class", value.getClass().getName());
    for (String method : methodNames) {
      Object result = invoke(value, method);
      if (result != null) {
        item.put(method, String.valueOf(result));
      }
    }
    return item;
  }

  private static List<Map<String, Object>> inspectCollection(Object value) {
    List<Map<String, Object>> items = new ArrayList<>();
    if (!(value instanceof Iterable)) {
      return items;
    }

    for (Object element : (Iterable<?>) value) {
      Map<String, Object> item = new LinkedHashMap<>();
      item.put("class", element != null ? element.getClass().getName() : null);
      item.put("uniqueName", invokeString(element, "getUniqueName"));
      item.put("componentName", invokeString(element, "getComponentName"));
      item.put("label", invokeString(element, "getLabel"));
      item.put("name", invokeString(element, "getName"));
      items.add(item);
    }

    return items;
  }

  private static List<Map<String, Object>> inspectConnectionsFromNodes(Object value) {
    List<Map<String, Object>> items = new ArrayList<>();
    if (!(value instanceof Iterable)) {
      return items;
    }

    for (Object node : (Iterable<?>) value) {
      String source = nodeName(node);
      Object outgoing = invoke(node, "getOutgoingConnections");
      if (!(outgoing instanceof Iterable)) {
        continue;
      }

      for (Object connection : (Iterable<?>) outgoing) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("source", source);
        item.put("target", nodeName(invokeFirst(connection, "getTarget", "getTargetNode")));
        if (item.get("target") == null) {
          item.put("target", invokeString(connection, "getTargetUniqueName"));
        }
        item.put("name", invokeString(connection, "getName"));
        item.put("type", invokeString(connection, "getLineStyle"));
        items.add(item);
      }
    }

    return items;
  }

  private static String invokeString(Object value, String methodName) {
    Object result = invoke(value, methodName);
    return result != null ? String.valueOf(result) : null;
  }

  private static String nodeName(Object value) {
    if (value == null) {
      return null;
    }

    String uniqueName = invokeString(value, "getUniqueName");
    if (uniqueName != null) return uniqueName;

    String label = invokeString(value, "getLabel");
    if (label != null) return label;

    return invokeString(value, "getName");
  }

  private static List<String> collectUnsupported(Object nodes, List<Map<String, Object>> connections) {
    List<String> unsupported = new ArrayList<>();
    if (!(nodes instanceof Iterable)) {
      unsupported.add("getGraphicalNodes/getNodes no existe");
    }
    if (connections.isEmpty()) {
      unsupported.add("getConnections no existe");
    }
    return unsupported;
  }
}
