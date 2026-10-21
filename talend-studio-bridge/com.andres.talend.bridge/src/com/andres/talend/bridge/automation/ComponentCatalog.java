package com.andres.talend.bridge.automation;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import com.google.gson.JsonObject;

/**
 * Catalogo de componentes de Talend.
 *
 * El MCP no puede adivinar como se configura un componente: cada uno tiene sus
 * parametros, con su tipo y su valor por defecto. Esta clase los lee del
 * catalogo que publica el propio Studio, de modo que la configuracion se
 * puede hacer para cualquier componente sin una tabla hardcodeada.
 */
public final class ComponentCatalog {

  private ComponentCatalog() {}

  /**
   * Lista los componentes del catalogo.
   *
   * @param spec opcionalmente `filter` (texto que tiene que aparecer en el
   *        nombre) y `limit`.
   */
  public static Map<String, Object> list(JsonObject spec) throws Exception {
    String filter = JsonSpec.string(spec, "filter");
    int limit = JsonSpec.string(spec, "limit") != null
        ? Integer.parseInt(JsonSpec.string(spec, "limit"))
        : 200;

    List<String> names = new ArrayList<>();
    for (Object component : components()) {
      String name = String.valueOf(component.getClass().getMethod("getName").invoke(component));
      if (filter != null && !filter.trim().isEmpty() && !name.toLowerCase().contains(filter.toLowerCase())) {
        continue;
      }
      names.add(name);
      if (names.size() >= limit) {
        break;
      }
    }
    java.util.Collections.sort(names);

    Map<String, Object> result = new LinkedHashMap<>();
    result.put("count", names.size());
    result.put("components", names);
    return result;
  }

  /**
   * Parametros de un componente del catalogo.
   *
   * @param spec name del componente.
   */
  public static Map<String, Object> parameters(JsonObject spec) throws Exception {
    String name = JsonSpec.required(spec, "name");
    Object component = TalendApi.findCatalogComponent(name);
    if (component == null) {
      throw new IllegalStateException("Componente '" + name + "' no encontrado en el catalogo de Talend");
    }

    // Se crea un nodo con el componente: eso es lo que hace el palette al
    // soltar el componente, y deja el nodo con los parametros que tendra en
    // el job, con sus valores por defecto.
    Class<?> nodeClass = TalendClasses.load("org.talend.designer.core.ui.editor.nodes.Node");
    Object node = nodeClass
        .getConstructor(TalendClasses.load("org.talend.core.model.components.IComponent"))
        .newInstance(component);
    createElementParameters(nodeClass, node);

    List<Map<String, Object>> parameters = new ArrayList<>();
    for (Object parameter : (List<?>) node.getClass().getMethod("getElementParameters").invoke(node)) {
      Map<String, Object> item = new LinkedHashMap<>();
      item.put("name", parameter.getClass().getMethod("getName").invoke(parameter));
      item.put("field", parameter.getClass().getMethod("getFieldType").invoke(parameter));
      Object value = parameter.getClass().getMethod("getValue").invoke(parameter);
      item.put("default", value == null ? null : String.valueOf(value));
      Object displayName = null;
      try {
        displayName = parameter.getClass().getMethod("getDisplayName").invoke(parameter);
      } catch (Exception e) {
        // El display name no es obligatorio.
      }
      if (displayName != null) {
        item.put("displayName", displayName);
      }
      // Los codigos de columna de las tablas: son los que hay que poner en
      // el spec para rellenar la tabla.
      List<String> columns = tableColumns(parameter);
      if (!columns.isEmpty()) {
        item.put("columns", columns);
      }
      parameters.add(item);
    }

    Map<String, Object> result = new LinkedHashMap<>();
    result.put("name", name);
    result.put("version", component.getClass().getMethod("getVersion").invoke(component));
    result.put("parameters", parameters);
    return result;
  }

  /**
   * Codigos de columna de un parametro de tipo TABLE.
   *
   * Las tablas del componente (las del tFilterRow, el tSortRow...) tienen sus
   * propias columnas, y hay que conocerlas para rellenar la tabla.
   */
  private static List<String> tableColumns(Object parameter) {
    List<String> columns = new ArrayList<>();
    try {
      Object codes = parameter.getClass().getMethod("getListItemsDisplayCodeName").invoke(parameter);
      if (codes instanceof Object[]) {
        for (Object code : (Object[]) codes) {
          columns.add(String.valueOf(code));
        }
      }
    } catch (Exception e) {
      // El parametro no tiene columnas de tabla.
    }
    return columns;
  }

  /** Componentes del catalogo de Studio. */
  private static Iterable<?> components() throws Exception {    Class<?> serviceClass = TalendClasses.load("org.talend.core.model.components.IComponentsService");
    Object service = serviceClass.getMethod("get").invoke(null);
    Object factory = service.getClass().getMethod("getComponentsFactory").invoke(service);
    Object components = factory.getClass().getMethod("getComponents").invoke(factory);
    if (!(components instanceof Iterable)) {
      return new ArrayList<>();
    }
    return (Iterable<?>) components;
  }

  /** Pide al componente que cree sus parametros (metodo no publico). */
  private static void createElementParameters(Class<?> nodeClass, Object node) {
    try {
      java.lang.reflect.Method create = null;
      for (java.lang.reflect.Method method : nodeClass.getDeclaredMethods()) {
        if ("createElementParameters".equals(method.getName()) && method.getParameterCount() == 0) {
          create = method;
          break;
        }
      }
      if (create == null) {
        return;
      }
      create.setAccessible(true);
      create.invoke(node);
    } catch (Exception e) {
      // El componente no expone el metodo: se devuelven los parametros vacios.
    }
  }
}
