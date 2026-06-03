package com.andres.talend.bridge;

import java.lang.reflect.Array;
import java.util.Iterator;
import java.util.Map;

final class JsonUtil {
  private JsonUtil() {}

  static String stringify(Object value) {
    StringBuilder sb = new StringBuilder();
    append(sb, value);
    return sb.toString();
  }

  private static void append(StringBuilder sb, Object value) {
    if (value == null) {
      sb.append("null");
      return;
    }

    if (value instanceof String) {
      sb.append('"').append(escape((String) value)).append('"');
      return;
    }

    if (value instanceof Number || value instanceof Boolean) {
      sb.append(String.valueOf(value));
      return;
    }

    if (value instanceof Map) {
      sb.append('{');
      Iterator<? extends Map.Entry<?, ?>> iterator = ((Map<?, ?>) value).entrySet().iterator();
      boolean first = true;
      while (iterator.hasNext()) {
        Map.Entry<?, ?> entry = iterator.next();
        if (!first) sb.append(',');
        first = false;
        append(sb, String.valueOf(entry.getKey()));
        sb.append(':');
        append(sb, entry.getValue());
      }
      sb.append('}');
      return;
    }

    if (value instanceof Iterable) {
      sb.append('[');
      boolean first = true;
      for (Object item : (Iterable<?>) value) {
        if (!first) sb.append(',');
        first = false;
        append(sb, item);
      }
      sb.append(']');
      return;
    }

    if (value.getClass().isArray()) {
      sb.append('[');
      int length = Array.getLength(value);
      for (int i = 0; i < length; i += 1) {
        if (i > 0) sb.append(',');
        append(sb, Array.get(value, i));
      }
      sb.append(']');
      return;
    }

    append(sb, String.valueOf(value));
  }

  private static String escape(String value) {
    return value
        .replace("\\", "\\\\")
        .replace("\"", "\\\"")
        .replace("\b", "\\b")
        .replace("\f", "\\f")
        .replace("\n", "\\n")
        .replace("\r", "\\r")
        .replace("\t", "\\t");
  }
}
