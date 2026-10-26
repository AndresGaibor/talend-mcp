package com.andres.talend.bridge.automation;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

/**
 * Configuracion declarativa de un componente de Talend.
 *
 * El nucleo del MCP no debe conocer componentes concretos: la configuracion se
 * declara y se aplica con la misma API para todos. Hay cuatro cosas que se
 * pueden configurar, y las cuatro son genericas:
 *
 * - `parameters`: los parametros del componente (`FILE_PATH`, `ENCODING`...).
 * - `tables`: los parametros de tipo TABLE, con sus columnas y sus filas.
 * - `schema`: el metadata del nodo, por conector y por nombre de tabla.
 * - `mapper`: el modelo del tMap (transformaciones, filtros y joins).
 *
 * Lo que sea especifico de un componente (hoy solo el `mapper`) vive en un
 * adaptador aparte: anadir soporte para un componente nuevo es anadir un
 * adaptador, sin tocar el nucleo.
 *
 * Formato del spec:
 *
 * ```json
 * {
 *   "parameters": { "FILE_PATH": { "value": "C:/datos/clientes.csv" },
 *                   "ENCODING": { "value": "UTF-8" } },
 *   "tables": { "INTABLE": { "columns": ["id", "ciudad"],
 *                            "rows": [["1", "Bogota"]] } },
 *   "schema": [ { "connector": "FLOW", "name": "tLogRow_1",
 *                 "columns": [ { "name": "id", "type": "id_Integer" } ] } ],
 *   "mapper": { "inputs": [], "outputs": [], "vars": [] }
 * }
 * ```
 */
public final class ComponentConfigurator {

  private ComponentConfigurator() {}

  /**
   * Aplica toda la configuracion de un nodo.
   *
   * @param node nodo recien creado, todavia sin anadir al proceso.
   * @param spec configuracion declarada.
   */
  public static void configure(Object node, JsonObject spec) throws Exception {
    if (JsonSpec.booleanOf(spec, "onlyIfEmpty", false)) {
      applyParametersIfEmpty(node, spec);
    } else {
      applyParameters(node, spec);
    }
    applyTables(node, spec);
    applySchema(node, spec);
    applyNodeData(node, spec);
    ComponentParameterConfigurator.fixErrorTrigger(node);
  }

  /**
   * Aplica los parametros solo donde el nodo todavia no tiene valor.
   *
   * El plan de relleno lo calcula el MCP leyendo la definicion del
   * componente (el XML de Studio): si el nodo ya trae un valor (el que Studio
   * pone por defecto), se respeta y no se pisa.
   */
  public static void applyParametersIfEmpty(Object node, JsonObject spec) throws Exception {
    ComponentParameterConfigurator.applyParametersIfEmpty(node, spec);
  }

  public static void applyParameters(Object node, JsonObject spec) throws Exception {
    ComponentParameterConfigurator.applyParameters(node, spec);
  }

  public static String asLiteral(String value, Boolean forceLiteral) {
    if (value == null) {
      return null;
    }
    if (forceLiteral != null) {
      return forceLiteral ? quote(value) : value;
    }
    String trimmed = value.trim();
    if (trimmed.isEmpty()) {
      return value;
    }
    if (trimmed.length() >= 2 && trimmed.startsWith("\"") && trimmed.endsWith("\"")) {
      return value;
    }
    if ("true".equalsIgnoreCase(trimmed) || "false".equalsIgnoreCase(trimmed)) {
      return value;
    }
    if (trimmed.matches("-?\\d+(\\.\\d+)?")) {
      return value;
    }
    return quote(value);
  }

  /** Entrecomilla un valor, escapando lo que haya que escapar. */
  public static String quote(String value) {
    return "\"" + value.replace("\\", "\\\\").replace("\"", "\\\"") + "\"";
  }

  // ---------------------------------------------------------------------
  // Tablas
  // ---------------------------------------------------------------------

  /**
   * Rellena los parametros de tipo TABLE.
   *
   * El formato en memoria de una tabla es una lista de mapas: cada mapa es
   * una fila y sus claves son los codigos de columna de la tabla. Talend lo
   * serializa como `elementValue` dentro del `elementParameter` de tipo TABLE.
   *
   * Las filas se pueden dar como arrays (se emparejan con los codigos de la
   * tabla, en orden) o como objetos (se usan tal cual).
   */
  public static void applyTables(Object node, JsonObject spec) throws Exception {
    ComponentTableConfigurator.apply(node, spec);
  }

  public static void applySchema(Object node, JsonObject spec) throws Exception {
    ComponentSchemaConfigurator.apply(node, spec);
  }

  // Modelo del componente
  // ---------------------------------------------------------------------

  /**
   * Aplica el modelo especifico del componente, si lo tiene.
   *
   * Hoy solo el tMap: sus transformaciones, sus filtros y sus joins viven en
   * un modelo propio (el `nodeData` del `.item`).
   */
  public static void applyNodeData(Object node, JsonObject spec) throws Exception {
    JsonElement mapper = spec.get("mapper");
    if (mapper != null && mapper.isJsonObject()) {
      MapperConfigurer.configure(node, mapper.getAsJsonObject());
    }
  }

  // ---------------------------------------------------------------------
  // Utilidades
  // ---------------------------------------------------------------------

  /**
   * Convierte un valor en el literal Java que espera el codigo generado.
   *
   * Las cadenas van entre comillas: el generador escribe el valor tal cual en
   * el codigo, asi que un texto sin comillas no compila. Y los numeros llevan
   * el sufijo de su tipo, porque `100` es un int y no un Double.
   */
  public static String javaLiteral(String value, String type) {
    if (value == null) {
      return "null";
    }
    String trimmed = value.trim();
    if (trimmed.isEmpty()) {
      return "null";
    }
    String kind = type == null ? "" : type;
    if (kind.startsWith("id_String") || kind.startsWith("id_Character")
        || kind.startsWith("id_Password") || kind.startsWith("id_Dynamic")) {
      return "\"" + trimmed.replace("\\", "\\\\").replace("\"", "\\\"") + "\"";
    }
    if (kind.startsWith("id_Boolean")) {
      return trimmed.equalsIgnoreCase("true") ? "true" : "false";
    }
    if (kind.startsWith("id_Date")) {
      Long millis = dateToMillis(trimmed);
      return millis == null ? "null" : "new java.sql.Timestamp(" + millis + "L)";
    }
    if (kind.startsWith("id_BigDecimal")) {
      return "new java.math.BigDecimal(\"" + trimmed + "\")";
    }
    if (kind.startsWith("id_Long") && !trimmed.endsWith("L") && !trimmed.endsWith("l")) {
      return trimmed + "L";
    }
    if ((kind.startsWith("id_Double") || kind.startsWith("id_Float"))
        && !trimmed.contains(".") && !trimmed.contains("E") && !trimmed.contains("e")
        && !trimmed.endsWith("d") && !trimmed.endsWith("f")) {
      return trimmed + ".0";
    }
    return trimmed;
  }

  /** Convierte una fecha `yyyy-MM-dd[ HH:mm:ss]` a milisegundos. */
  public static Long dateToMillis(String value) {
    String[] patterns = {"yyyy-MM-dd HH:mm:ss", "yyyy-MM-dd'T'HH:mm:ss", "yyyy-MM-dd"};
    for (String pattern : patterns) {
      try {
        java.time.format.DateTimeFormatter formatter =
            java.time.format.DateTimeFormatter.ofPattern(pattern);
        return java.time.LocalDateTime.parse(value, formatter)
            .atZone(java.time.ZoneId.systemDefault())
            .toInstant()
            .toEpochMilli();
      } catch (RuntimeException e) {
        // Se prueba con el siguiente patron.
      }
    }
    return null;
  }

  /** Carga una clase de Talend por su nombre. */
  static Class<?> talendClass(String name) throws Exception {
    return TalendClasses.load(name);
  }
}
