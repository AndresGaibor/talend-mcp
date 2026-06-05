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

  public static Map<String, Object> activeJobDetails() {
    IWorkbenchPage page = activePage();
    IEditorPart editor = page != null ? page.getActiveEditor() : null;
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("ok", true);
    payload.put("source", "studio-bridge");
    payload.put("confidence", editor != null ? "medium" : "low");
    payload.put("endpoint", "/talend/active-job/details");

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
    List<Map<String, Object>> components = new ArrayList<>();
    if (nodes instanceof Iterable) {
      for (Object element : (Iterable<?>) nodes) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("class", element != null ? element.getClass().getName() : null);
        String uniqueName = invokeString(element, "getUniqueName");
        item.put("uniqueName", uniqueName);
        item.put("componentName", invokeString(element, "getComponentName"));
        item.put("label", invokeString(element, "getLabel"));
        item.put("name", invokeString(element, "getName"));
        
        // Position
        Object posX = invoke(element, "getPosX");
        Object posY = invoke(element, "getPosY");
        if (posX instanceof Number) item.put("posX", ((Number) posX).intValue());
        if (posY instanceof Number) item.put("posY", ((Number) posY).intValue());
        
        components.add(item);
      }
    }
    
    List<Map<String, Object>> connections = new ArrayList<>();
    Object conns = invokeFirst(process, "getConnections");
    if (conns instanceof Iterable) {
      for (Object conn : (Iterable<?>) conns) {
        connections.add(inspectConnection(conn));
      }
    }
    if (connections.isEmpty()) {
      connections = inspectConnectionsFromNodes(nodes);
    }
    
    payload.put("components", components);
    payload.put("connections", connections);
    payload.put("unsupported", collectUnsupported(nodes, connections));
    return payload;
  }

  public static Map<String, Object> activeComponentDetails(String uniqueName, boolean includeRaw) {
    IWorkbenchPage page = activePage();
    IEditorPart editor = page != null ? page.getActiveEditor() : null;
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("ok", true);
    payload.put("source", "studio-bridge");
    payload.put("confidence", editor != null ? "medium" : "low");
    payload.put("endpoint", "/talend/active-component/details");

    if (editor == null) {
      payload.put("ok", false);
      payload.put("warning", "No hay editor activo");
      return payload;
    }

    Object process = invokeFirst(editor, "getProcess", "getProcessItem");
    if (process == null) {
      payload.put("ok", false);
      payload.put("warning", "El editor activo no expone getProcess/getProcessItem");
      return payload;
    }

    // Find the node
    Object nodes = invokeFirst(process, "getGraphicalNodes", "getNodes");
    Object targetNode = null;
    if (nodes instanceof Iterable) {
      for (Object node : (Iterable<?>) nodes) {
        String name = invokeString(node, "getUniqueName");
        if (uniqueName != null && uniqueName.equals(name)) {
          targetNode = node;
          break;
        }
      }
    }

    if (targetNode == null) {
      payload.put("ok", false);
      payload.put("warning", "Componente no encontrado: " + uniqueName);
      return payload;
    }

    // Return job context info
    Map<String, Object> jobInfo = inspectObject(process, java.util.Arrays.asList("getLabel", "getName", "getVersion"));
    if (editor.getTitle() != null) {
      jobInfo.put("editorTitle", editor.getTitle());
    }
    payload.put("job", jobInfo);

    // Component details
    Map<String, Object> compInfo = new LinkedHashMap<>();
    compInfo.put("uniqueName", uniqueName);
    compInfo.put("label", invokeString(targetNode, "getLabel"));
    compInfo.put("componentName", invokeString(targetNode, "getComponentName"));
    compInfo.put("className", targetNode.getClass().getName());
    
    // Position
    Object posX = invoke(targetNode, "getPosX");
    Object posY = invoke(targetNode, "getPosY");
    if (posX instanceof Number) compInfo.put("posX", ((Number) posX).intValue());
    if (posY instanceof Number) compInfo.put("posY", ((Number) posY).intValue());

    // Parameters
    List<Map<String, Object>> paramsList = new ArrayList<>();
    Object params = invoke(targetNode, "getElementParameters");
    if (params instanceof Iterable) {
      for (Object param : (Iterable<?>) params) {
        Map<String, Object> paramMap = new LinkedHashMap<>();
        paramMap.put("name", invokeString(param, "getName"));
        Object val = invoke(param, "getValue");
        paramMap.put("value", val != null ? String.valueOf(val) : "");
        Object fieldType = invoke(param, "getFieldType");
        if (fieldType != null) {
          paramMap.put("field", String.valueOf(fieldType));
        }
        Object showObj = invoke(param, "isShow");
        if (showObj instanceof Boolean) {
          paramMap.put("show", (Boolean) showObj);
        }
        paramsList.add(paramMap);
      }
    }
    compInfo.put("parameters", paramsList);

    // Schemas (metadataList)
    List<Map<String, Object>> schemasList = new ArrayList<>();
    Object metadataList = invoke(targetNode, "getMetadataList");
    if (metadataList instanceof Iterable) {
      for (Object meta : (Iterable<?>) metadataList) {
        Map<String, Object> schemaMap = new LinkedHashMap<>();
        schemaMap.put("name", invokeString(meta, "getTableName"));
        schemaMap.put("connector", invokeString(meta, "getConnector"));
        schemaMap.put("label", invokeString(meta, "getLabel"));
        
        List<Map<String, Object>> columnsList = new ArrayList<>();
        Object columns = invoke(meta, "getListColumns");
        if (columns instanceof Iterable) {
          for (Object col : (Iterable<?>) columns) {
            Map<String, Object> colMap = new LinkedHashMap<>();
            colMap.put("name", invokeString(col, "getLabel"));
            colMap.put("type", invokeString(col, "getTalendType"));
            
            Object len = invoke(col, "getLength");
            if (len instanceof Number) colMap.put("length", ((Number) len).intValue());
            
            Object prec = invoke(col, "getPrecision");
            if (prec instanceof Number) colMap.put("precision", ((Number) prec).intValue());
            
            Object nullable = invoke(col, "isNullable");
            if (nullable instanceof Boolean) colMap.put("nullable", (Boolean) nullable);
            
            Object key = invoke(col, "isKey");
            if (key instanceof Boolean) colMap.put("key", (Boolean) key);
            
            columnsList.add(colMap);
          }
        }
        schemaMap.put("columns", columnsList);
        schemasList.add(schemaMap);
      }
    }
    compInfo.put("schemas", schemasList);

    // Incoming connections
    List<Map<String, Object>> incomingList = new ArrayList<>();
    Object incoming = invoke(targetNode, "getIncomingConnections");
    if (incoming instanceof Iterable) {
      for (Object conn : (Iterable<?>) incoming) {
        incomingList.add(inspectConnection(conn));
      }
    }
    compInfo.put("incomingConnections", incomingList);

    // Outgoing connections
    List<Map<String, Object>> outgoingList = new ArrayList<>();
    Object outgoing = invoke(targetNode, "getOutgoingConnections");
    if (outgoing instanceof Iterable) {
      for (Object conn : (Iterable<?>) outgoing) {
        outgoingList.add(inspectConnection(conn));
      }
    }
    compInfo.put("outgoingConnections", outgoingList);

    if ("tMap".equals(compInfo.get("componentName"))) {
      compInfo.put("tMapData", extractTMapData(targetNode));
    }

    if (includeRaw) {
      Map<String, Object> rawMap = new LinkedHashMap<>();
      rawMap.put("class", targetNode.getClass().getName());
      compInfo.put("raw", rawMap);
    }

    payload.put("component", compInfo);
    return payload;
  }

  public static Map<String, Object> selectComponent(String uniqueName) {
    IWorkbenchPage page = activePage();
    IEditorPart editor = page != null ? page.getActiveEditor() : null;
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("ok", false);
    payload.put("source", "studio-bridge");
    payload.put("endpoint", "/talend/active-job/select-component");

    if (editor == null) {
      payload.put("warning", "No hay editor activo");
      return payload;
    }

    Object process = invokeFirst(editor, "getProcess", "getProcessItem");
    if (process == null) {
      payload.put("warning", "El editor activo no expone getProcess");
      return payload;
    }

    Object nodes = invokeFirst(process, "getGraphicalNodes", "getNodes");
    Object targetNode = null;
    if (nodes instanceof Iterable) {
      for (Object node : (Iterable<?>) nodes) {
        String name = invokeString(node, "getUniqueName");
        if (uniqueName != null && uniqueName.equals(name)) {
          targetNode = node;
          break;
        }
      }
    }

    if (targetNode == null) {
      payload.put("warning", "Componente no encontrado: " + uniqueName);
      return payload;
    }

    try {
      Method getAdapterMethod = editor.getClass().getMethod("getAdapter", Class.class);
      ClassLoader cl = editor.getClass().getClassLoader();
      Class<?> viewerClass = cl.loadClass("org.eclipse.gef.EditPartViewer");
      Object viewer = getAdapterMethod.invoke(editor, viewerClass);
      if (viewer != null) {
        Method getRegistryMethod = viewer.getClass().getMethod("getEditPartRegistry");
        Map<?, ?> registry = (Map<?, ?>) getRegistryMethod.invoke(viewer);
        Object editPart = registry.get(targetNode);
        if (editPart != null) {
          Class<?> structuredSelectionClass = cl.loadClass("org.eclipse.jface.viewers.StructuredSelection");
          Object selection = structuredSelectionClass.getConstructor(Object.class).newInstance(editPart);
          
          Method setSelectionMethod = viewer.getClass().getMethod("setSelection", cl.loadClass("org.eclipse.jface.viewers.ISelection"));
          setSelectionMethod.invoke(viewer, selection);
          
          Method revealMethod = viewer.getClass().getMethod("reveal", cl.loadClass("org.eclipse.gef.EditPart"));
          revealMethod.invoke(viewer, editPart);
          
          payload.put("ok", true);
          payload.put("selected", true);
          return payload;
        }
      }
    } catch (Exception e) {
      payload.put("warning", "Error al intentar seleccionar via GEF: " + e.getMessage());
    }

    return payload;
  }

  private static Map<String, Object> inspectConnection(Object conn) {
    Map<String, Object> connMap = new LinkedHashMap<>();
    connMap.put("name", invokeString(conn, "getName"));
    connMap.put("type", invokeString(conn, "getLineStyle"));
    connMap.put("connectorName", invokeString(conn, "getConnectorName"));
    connMap.put("source", nodeName(invokeFirst(conn, "getSource", "getSourceNode")));
    connMap.put("target", nodeName(invokeFirst(conn, "getTarget", "getTargetNode")));
    return connMap;
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

  private static Map<String, Object> extractTMapData(Object targetNode) {
    Map<String, Object> tmapData = new LinkedHashMap<>();
    try {
      Object extData = invoke(targetNode, "getExternalData");
      if (extData != null) {
        tmapData.put("inputTables", extractMapperTables(invoke(extData, "getInputTables")));
        tmapData.put("outputTables", extractMapperTables(invoke(extData, "getOutputTables")));
        tmapData.put("varTables", extractMapperTables(invoke(extData, "getVarTables")));
      }
    } catch (Exception e) {
      tmapData.put("error", e.getMessage());
    }
    return tmapData;
  }

  private static List<Map<String, Object>> extractMapperTables(Object tables) {
    List<Map<String, Object>> list = new ArrayList<>();
    if (tables instanceof Iterable) {
      for (Object table : (Iterable<?>) tables) {
        Map<String, Object> tableMap = new LinkedHashMap<>();
        tableMap.put("name", invokeString(table, "getName"));
        
        List<Map<String, Object>> entriesList = new ArrayList<>();
        Object entries = invokeFirst(table, "getMetadataTableEntries", "getMetadataTableEntry");
        if (entries instanceof Iterable) {
          for (Object entry : (Iterable<?>) entries) {
            Map<String, Object> entryMap = new LinkedHashMap<>();
            entryMap.put("name", invokeString(entry, "getName"));
            entryMap.put("expression", invokeString(entry, "getExpression"));
            entriesList.add(entryMap);
          }
        }
        tableMap.put("entries", entriesList);
        list.add(tableMap);
      }
    }
    return list;
  }
}
