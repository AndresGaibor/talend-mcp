package com.andres.talend.bridge;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;

/**
 * Serializacion JSON del bridge.
 *
 * Se usa Gson (incluido en la instalacion de Talend Studio) en vez de un
 * serializador a mano: el formato de los payloads incluye HTML y XML, y Gson
 * con {@code disableHtmlEscaping()} los deja legibles.
 */
public final class JsonUtil {
  private static final Gson GSON = new GsonBuilder()
      .disableHtmlEscaping()
      .serializeNulls()
      .create();

  private JsonUtil() {}

  public static String stringify(Object value) {
    return GSON.toJson(value);
  }
}
