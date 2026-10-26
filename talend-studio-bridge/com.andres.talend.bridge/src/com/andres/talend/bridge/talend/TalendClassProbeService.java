package com.andres.talend.bridge.talend;

import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import com.andres.talend.bridge.automation.TalendClasses;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import org.osgi.framework.Bundle;
import org.osgi.framework.FrameworkUtil;

/**
 * Comprueba, en la instalacion de Talend Studio que esta en marcha, que existen
 * las clases y los metodos que el bridge usa por reflexion.
 *
 * Los nombres se escriben como texto en el codigo, y una version de Studio que
 * los renombre no da error de compilacion. Esta comprobacion es el antidoto:
 * sirve para ver en segundos que API tiene esta instalacion.
 */
public final class TalendClassProbeService {

  /** Maximo de clases o metodos por peticion, para que una consulta no sea un barrido. */
  private static final int MAX_ITEMS = 200;

  /** Clases del camino principal del bridge. */
  private static final List<String> PROBES = List.of(
      "org.talend.designer.core.ui.editor.TalendEditor",
      "org.talend.core.model.process.IProcess",
      "org.talend.core.model.process.IProcess2",
      "org.talend.core.model.process.INode",
      "org.talend.core.model.process.IConnection",
      "org.talend.repository.model.IRepositoryNode",
      "org.talend.core.model.properties.ProcessItem",
      "org.talend.core.model.properties.Property");

  private TalendClassProbeService() {}

  /** Comprueba las clases del camino principal del bridge. */
  public static Map<String, Object> probe() {
    List<Map<String, Object>> classes = new ArrayList<>();
    for (String name : PROBES) {
      classes.add(classInfo(name));
    }
    return payload("/talend/probe/classes", classes, List.of());
  }

  /**
   * Comprueba clases y metodos o campos que se pidan en el cuerpo:
   * {"classes":["org...."], "members":[{"class":"org....","name":"getX","kind":"method"}]}.
   * `kind` es "method" (por defecto) o "field".
   */
  public static Map<String, Object> check(JsonObject spec) {
    List<Map<String, Object>> classes = new ArrayList<>();
    for (String name : strings(spec.get("classes"))) {
      classes.add(classInfo(name));
    }
    List<Map<String, Object>> members = new ArrayList<>();
    for (JsonObject member : objects(spec.get("members"))) {
      members.add(memberInfo(member));
    }
    return payload("/talend/api/check", classes, members);
  }

  private static Map<String, Object> classInfo(String className) {
    Map<String, Object> item = new LinkedHashMap<>();
    item.put("name", className);
    item.put("available", false);
    item.put("loadedFromBundle", null);
    try {
      Class<?> loaded = TalendClasses.load(className);
      item.put("available", true);
      // Bundle.loadClass puede delegar en otro bundle: el origen real es el del class object.
      Bundle source = FrameworkUtil.getBundle(loaded);
      item.put("loadedFromBundle", source == null ? null : source.getSymbolicName());
    } catch (ClassNotFoundException | LinkageError e) {
      item.put("error", e.getClass().getSimpleName());
    }
    return item;
  }

  private static Map<String, Object> memberInfo(JsonObject spec) {
    String className = text(spec, "class");
    String name = text(spec, "name");
    String kind = text(spec, "kind") == null ? "method" : text(spec, "kind");
    Map<String, Object> item = new LinkedHashMap<>();
    item.put("class", className);
    item.put("name", name);
    item.put("kind", kind);
    item.put("available", false);
    item.put("declaredIn", null);
    if (className == null || name == null) {
      item.put("error", "faltan 'class' o 'name'");
      return item;
    }
    try {
      Class<?> type = TalendClasses.load(className);
      if ("field".equals(kind)) {
        for (java.lang.reflect.Field field : type.getFields()) {
          if (field.getName().equals(name)) {
            item.put("available", true);
            item.put("declaredIn", field.getDeclaringClass().getName());
            break;
          }
        }
      } else {
        for (Method method : type.getMethods()) {
          if (method.getName().equals(name)) {
            item.put("available", true);
            item.put("declaredIn", method.getDeclaringClass().getName());
            break;
          }
        }
      }
    } catch (ClassNotFoundException | LinkageError e) {
      item.put("error", e.getClass().getSimpleName());
    }
    return item;
  }

  private static Map<String, Object> payload(String endpoint, List<Map<String, Object>> classes,
      List<Map<String, Object>> members) {
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("ok", true);
    payload.put("source", "studio-bridge");
    payload.put("confidence", "high");
    payload.put("endpoint", endpoint);
    payload.put("classes", classes.subList(0, Math.min(classes.size(), MAX_ITEMS)));
    payload.put("members", members.subList(0, Math.min(members.size(), MAX_ITEMS)));
    return payload;
  }

  private static List<String> strings(JsonElement element) {
    List<String> out = new ArrayList<>();
    if (element instanceof JsonArray) {
      for (JsonElement item : (JsonArray) element) {
        if (item.isJsonPrimitive()) out.add(item.getAsString());
      }
    }
    return out;
  }

  private static List<JsonObject> objects(JsonElement element) {
    List<JsonObject> out = new ArrayList<>();
    if (element instanceof JsonArray) {
      for (JsonElement item : (JsonArray) element) {
        if (item.isJsonObject()) out.add(item.getAsJsonObject());
      }
    }
    return out;
  }

  private static String text(JsonObject object, String key) {
    JsonElement element = object.get(key);
    return element != null && element.isJsonPrimitive() ? element.getAsString() : null;
  }
}
