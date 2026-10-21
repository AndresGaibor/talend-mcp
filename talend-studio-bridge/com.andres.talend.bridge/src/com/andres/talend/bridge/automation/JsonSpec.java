package com.andres.talend.bridge.automation;

import java.util.ArrayList;
import java.util.List;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

/**
 * Lectura del spec de las operaciones.
 *
 * El spec es el JSON que manda el MCP. Es la unica forma de pedirle algo al
 * bridge, asi que su lectura vive en un solo sitio: si hay que cambiar como se
 * interpretan los parametros, se cambia aqui y no en cada operacion.
 */
public final class JsonSpec {

  private JsonSpec() {}

  /** Texto obligatorio. */
  public static String required(JsonObject spec, String key) {
    String value = string(spec, key);
    if (value == null || value.trim().isEmpty()) {
      throw new IllegalArgumentException("Falta el parametro '" + key + "'");
    }
    return value;
  }

  /** Texto opcional. */
  public static String string(JsonObject object, String key) {
    if (object == null || !object.has(key) || object.get(key).isJsonNull()) {
      return null;
    }
    return object.get(key).getAsString();
  }

  /** Texto opcional, o cadena vacia. */
  public static String stringOrEmpty(JsonObject object, String key) {
    String value = string(object, key);
    return value == null ? "" : value;
  }

  /** Booleano opcional, con valor por defecto. */
  public static boolean booleanOf(JsonObject object, String key, boolean fallback) {
    if (object == null || !object.has(key) || object.get(key).isJsonNull()) {
      return fallback;
    }
    try {
      return object.get(key).getAsBoolean();
    } catch (RuntimeException e) {
      return fallback;
    }
  }

  /** Objeto anidado, o uno vacio. */
  public static JsonObject objectOf(JsonObject parent, String key) {
    if (parent == null || !parent.has(key) || !parent.get(key).isJsonObject()) {
      return new JsonObject();
    }
    return parent.get(key).getAsJsonObject();
  }

  /** Array de objetos, o lista vacia. */
  public static List<JsonObject> arrayOf(JsonObject parent, String key) {
    List<JsonObject> items = new ArrayList<>();
    if (parent == null || !parent.has(key) || !parent.get(key).isJsonArray()) {
      return items;
    }
    for (JsonElement element : parent.get(key).getAsJsonArray()) {
      if (element.isJsonObject()) {
        items.add(element.getAsJsonObject());
      }
    }
    return items;
  }

  /** Array de textos, o lista vacia. */
  public static List<String> stringList(JsonObject parent, String key) {
    List<String> items = new ArrayList<>();
    if (parent == null || !parent.has(key) || !parent.get(key).isJsonArray()) {
      return items;
    }
    for (JsonElement element : parent.get(key).getAsJsonArray()) {
      if (element.isJsonPrimitive()) {
        items.add(element.getAsString());
      }
    }
    return items;
  }

  /** Array crudo, o null. */
  public static JsonArray rawArray(JsonObject parent, String key) {
    if (parent == null || !parent.has(key) || !parent.get(key).isJsonArray()) {
      return null;
    }
    return parent.get(key).getAsJsonArray();
  }
}
