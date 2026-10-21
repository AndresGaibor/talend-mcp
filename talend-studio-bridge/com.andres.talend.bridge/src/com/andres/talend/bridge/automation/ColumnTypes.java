package com.andres.talend.bridge.automation;

import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

/**
 * Tipos Java de columna que acepta Talend.
 *
 * Un id que no existe hace fallar la generacion de codigo con
 * `Unknown java id type`. Ver docs/TALEND-STUDIO-INTERNALS.md.
 */
public final class ColumnTypes {

  private ColumnTypes() {}

  /** Tipos Java validos de columna. */
  private static final Set<String> VALID = new HashSet<>(Arrays.asList(
      "id_String", "id_Integer", "id_Long", "id_Double", "id_Float", "id_BigDecimal",
      "id_Boolean", "id_Byte", "id_Short", "id_Character", "id_Date", "id_Password",
      "id_Dynamic"));

  /** Alias en ingles de los tipos Java de columna. */
  private static final Map<String, String> ALIASES = new HashMap<>();

  static {
    ALIASES.put("string", "id_String");
    ALIASES.put("text", "id_String");
    ALIASES.put("varchar", "id_String");
    ALIASES.put("char", "id_Character");
    ALIASES.put("int", "id_Integer");
    ALIASES.put("integer", "id_Integer");
    ALIASES.put("long", "id_Long");
    ALIASES.put("bigint", "id_Long");
    ALIASES.put("double", "id_Double");
    ALIASES.put("float", "id_Float");
    ALIASES.put("real", "id_Double");
    ALIASES.put("decimal", "id_BigDecimal");
    ALIASES.put("numeric", "id_BigDecimal");
    ALIASES.put("bigdecimal", "id_BigDecimal");
    ALIASES.put("boolean", "id_Boolean");
    ALIASES.put("bool", "id_Boolean");
    ALIASES.put("byte", "id_Byte");
    ALIASES.put("short", "id_Short");
    ALIASES.put("date", "id_Date");
    ALIASES.put("datetime", "id_Date");
    ALIASES.put("timestamp", "id_Date");
    ALIASES.put("password", "id_Password");
  }

  /**
   * Normaliza un tipo de columna al identificador Java de Talend.
   *
   * Lo que no se reconoce se deja como `id_String`, que es el tipo por
   * defecto de Studio.
   */
  public static String normalize(String type) {
    if (type == null || type.trim().isEmpty()) {
      return "id_String";
    }
    if (VALID.contains(type)) {
      return type;
    }
    String alias = ALIASES.get(type.toLowerCase());
    return alias != null ? alias : "id_String";
  }

  /**
   * Tipo Java de una columna de metadata.
   *
   * El tipo util es el `talendType`: el `type` de la columna de metadata suele
   * venir vacio y el que se serializa en el `.item` es el otro.
   */
  public static String of(Object column) {
    try {
      Object talendType = column.getClass().getMethod("getTalendType").invoke(column);
      if (talendType != null && !String.valueOf(talendType).trim().isEmpty()) {
        return normalize(String.valueOf(talendType));
      }
    } catch (Exception e) {
      // Se prueba con el type.
    }
    try {
      Object type = column.getClass().getMethod("getType").invoke(column);
      return type == null ? "id_String" : normalize(String.valueOf(type));
    } catch (Exception e) {
      return "id_String";
    }
  }
}
