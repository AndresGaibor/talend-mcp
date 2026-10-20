package com.andres.talend.bridge.automation;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import com.andres.talend.bridge.BridgeLog;
import com.andres.talend.bridge.workbench.WorkbenchService;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import org.eclipse.core.resources.IProject;
import org.eclipse.draw2d.geometry.Point;
import org.eclipse.gef.EditPart;
import org.eclipse.gef.commands.Command;

/**
 * Opera sobre el job abierto en Talend Studio con la API del propio IDE.
 *
 * Antes el MCP escribia el `.item` a mano. Eso obligaba a reproducir el
 * formato XML de Talend (context, metadata, LENGTHS, tipos Java) y a forzar
 * despues la recarga del modelo EMF, porque Studio no se entera de los
 * cambios hechos por fuera. Con esta API el modelo en memoria siempre es la
 * fuente de verdad y el formato lo pone Talend.
 *
 * Las operaciones de nodos y conexiones se hacen con los mismos comandos que
 * usa el editor de Talend: `CreateRequest` para anadir un nodo,
 * `ConnectionCreateCommand` para conectar y `DeleteNodeContainerCommand` para
 * borrar. Asi cada nodo nace con todos sus parametros y valores por defecto.
 *
 * Todo se hace por reflexion para no atar el bundle a los bundles de Talend:
 * el plugin se instala junto a distintas versiones de Studio.
 */
public final class JobOperationsService {

  private JobOperationsService() {}

  // ---------------------------------------------------------------------
  // Operaciones
  // ---------------------------------------------------------------------

  /**
   * Crea un job vacio en el repositorio de Talend y lo abre en el editor.
   *
   * El job se crea con la API del repositorio, de modo que Studio se encarga
   * del `.item` y del `.properties`. Despues se pueden anadir nodos con
   * `addNode` y conectarlos con `connect`.
   *
   * @param spec name, version, folder y description del job.
   */
  public static Map<String, Object> createJob(JsonObject spec) {
    return run("create-job", () -> {
      String name = required(spec, "name");
      // Talend exige que el label del job no tenga puntos ni guiones.
      if (!name.matches("^[a-zA-Z]+[a-zA-Z0-9_]*$")) {
        throw new IllegalArgumentException(
            "El nombre del job solo admite letras, digitos y guion bajo: " + name);
      }
      String version = string(spec, "version");
      if (version == null || version.trim().isEmpty()) {
        version = "0.1";
      }
      String folder = string(spec, "folder");
      if (folder == null) {
        folder = "";
      }

      Object project = currentProject();
      if (project == null) {
        throw new IllegalStateException("No hay ningun proyecto de Talend abierto");
      }

      Object repositoryFactory = repositoryFactory();
      if (repositoryFactory == null) {
        throw new IllegalStateException("El repositorio de Talend no esta disponible");
      }

      // Si ya hay un job con esa etiqueta, Studio abre el modal "Jobname
      // Error" ("Etiqueta X is already in use...") y el hilo de la UI se
      // queda dentro del dialogo: todo lo que se haga despues se cuelga.
      // Se decide aqui: o se falla con un mensaje claro, o se reemplaza.
      Object existing = findJobViewObject(repositoryFactory, name);
      if (existing != null) {
        if (!booleanOf(spec, "replace", false)) {
          throw new IllegalStateException(
              "Ya existe un job con la etiqueta '" + name + "'. Usa replace=true para reemplazarlo.");
        }
        deleteJobViewObject(repositoryFactory, project, existing);
      }

      // El item se crea desde cero. La clave es que el `ProcessType` (el
      // contenido del `.item`) tiene que vivir en un `TalendXMIResource` del
      // resource set del proyecto. Si se crea suelto, el repositorio lo
      // serializa vacio.
      Class<?> factoryClass = talendClass("org.talend.core.model.properties.PropertiesFactory");
      Object factory = factoryClass.getField("eINSTANCE").get(null);

      Object property = factoryClass.getMethod("createProperty").invoke(factory);
      property.getClass().getMethod("setId", String.class).invoke(property, generateId());
      property.getClass().getMethod("setLabel", String.class).invoke(property, name);
      property.getClass().getMethod("setDisplayName", String.class).invoke(property, name);
      property.getClass().getMethod("setVersion", String.class).invoke(property, version);
      String description = string(spec, "description");
      if (description != null && !description.isEmpty()) {
        property.getClass().getMethod("setDescription", String.class).invoke(property, description);
      }

      Object processItem = factoryClass.getMethod("createProcessItem").invoke(factory);
      processItem.getClass().getMethod("setProperty",
          talendClass("org.talend.core.model.properties.Property")).invoke(processItem, property);

      // El ItemState marca el item como vivo. Sin el, el repositorio lo
      // considera borrado.
      Object state = factoryClass.getMethod("createItemState").invoke(factory);
      processItem.getClass().getMethod("setState",
          talendClass("org.talend.core.model.properties.ItemState")).invoke(processItem, state);

      // El recurso del `.item`. El ultimo booleano decide el tipo: `false`
      // crea un TalendXMIResource (el del `.item`), `true` un ByteArrayResource
      // (el del `.properties`).
      Object xmiResourceManager = xmiResourceManager();
      IProject iProject = resourceProject();
      Class<?> typeClass = talendClass("org.talend.core.model.repository.ERepositoryObjectType");
      Object jobType = typeClass.getField("PROCESS").get(null);
      Object itemResource = xmiResourceManager.getClass()
          .getMethod("createItemResource", talendClass("org.eclipse.core.resources.IProject"),
              talendClass("org.talend.core.model.properties.Item"),
              org.eclipse.core.runtime.IPath.class, typeClass, boolean.class)
          .invoke(xmiResourceManager, iProject, processItem,
              itemResourcePath(folder, name, version), jobType, false);

      // El ProcessType va dentro del recurso, no suelto.
      Object talendFileFactory = talendClass(
          "org.talend.designer.core.model.utils.emf.talendfile.TalendFileFactory")
          .getField("eINSTANCE").get(null);
      Object processType = talendFileFactory.getClass().getMethod("createProcessType").invoke(talendFileFactory);
      // `EList` no es API pública de EMF: se maneja como lista a traves de
      // `getContents`, que devuelve la EList real.
      @SuppressWarnings("unchecked")
      java.util.List<Object> contents = (java.util.List<Object>) itemResource.getClass()
          .getMethod("getContents").invoke(itemResource);
      contents.add(processType);
      processItem.getClass().getMethod("setProcess",
          talendClass("org.talend.designer.core.model.utils.emf.talendfile.ProcessType"))
          .invoke(processItem, processType);

      // Registrar el item en el repositorio: `create` lo deja con su recurso
      // y escribe los tres archivos del job.
      repositoryFactory.getClass()
          .getMethod("create", talendClass("org.talend.core.model.general.Project"),
              talendClass("org.talend.core.model.properties.Item"),
              org.eclipse.core.runtime.IPath.class, boolean[].class)
          .invoke(repositoryFactory, project, processItem, processPath(folder, name, version),
              new boolean[0]);

      // Abrir el job: a partir de aqui se opera sobre el, con el editor.
      Map<String, Object> opened = openCreatedJob(processItem, name, version);
      if (!Boolean.TRUE.equals(opened.get("opened"))) {
        throw new IllegalStateException(
            "No se pudo abrir el job recien creado: " + opened.get("error"));
      }
      Map<String, Object> summary = new LinkedHashMap<>();
      summary.put("jobName", name);
      summary.put("version", version);
      summary.put("editorTitle", opened.get("editorTitle"));
      return summary;
    });
  }

  /**
   * Borra un job del proyecto.
   *
   * Se borra desde el repositorio, no desde el disco: si se borran solo los
   * archivos, el repositorio sigue con un item fantasma y la proxima vez que
   * se cree un job con la misma etiqueta salta el modal "Jobname Error".
   *
   * @param spec name del job y opcionalmente version.
   */
  public static Map<String, Object> deleteJob(JsonObject spec) {
    return run("delete-job", () -> {
      String name = required(spec, "name");
      Object project = currentProject();
      if (project == null) {
        throw new IllegalStateException("No hay ningun proyecto de Talend abierto");
      }
      Object repositoryFactory = repositoryFactory();
      if (repositoryFactory == null) {
        throw new IllegalStateException("El repositorio de Talend no esta disponible");
      }
      Object viewObject = findJobViewObject(repositoryFactory, name);
      if (viewObject == null) {
        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("deleted", false);
        summary.put("jobName", name);
        summary.put("message", "No habia ningun job con esa etiqueta");
        return summary;
      }
      deleteJobViewObject(repositoryFactory, project, viewObject);
      Map<String, Object> summary = new LinkedHashMap<>();
      summary.put("deleted", true);
      summary.put("jobName", name);
      return summary;
    });
  }

  /**
   * Busca un job del proyecto por su etiqueta.
   *
   * El repositorio no tiene un "buscar por etiqueta": se recorre el listado
   * de procesos del proyecto.
   */
  private static Object findJobViewObject(Object repositoryFactory, String name) throws Exception {
    Class<?> enumClass = repositoryFactory.getClass().getClassLoader()
        .loadClass("org.talend.core.model.repository.ERepositoryObjectType");
    Object processType = enumClass.getField("PROCESS").get(null);
    java.lang.reflect.Method getAll = null;
    for (java.lang.reflect.Method method : repositoryFactory.getClass().getMethods()) {
      if ("getAll".equals(method.getName()) && method.getParameterTypes().length == 1
          && method.getParameterTypes()[0].getName().equals(enumClass.getName())) {
        getAll = method;
        break;
      }
    }
    if (getAll == null) {
      return null;
    }
    Object all = getAll.invoke(repositoryFactory, processType);
    if (!(all instanceof Iterable)) {
      return null;
    }
    for (Object viewObject : (Iterable<?>) all) {
      Object label = viewObject.getClass().getMethod("getLabel").invoke(viewObject);
      if (name.equals(label)) {
        return viewObject;
      }
    }
    return null;
  }

  /** Borra un item del repositorio y sus archivos. */
  private static void deleteJobViewObject(Object repositoryFactory, Object project, Object viewObject)
      throws Exception {
    // El repositorio expone varias firmas de `deleteObjectPhysical`. Se usa
    // la mas simple: borra el item y sus archivos.
    java.lang.reflect.Method delete = null;
    for (java.lang.reflect.Method method : repositoryFactory.getClass().getMethods()) {
      if (!"deleteObjectPhysical".equals(method.getName())) {
        continue;
      }
      Class<?>[] parameters = method.getParameterTypes();
      if (parameters.length == 2
          && parameters[0].getName().equals("org.talend.core.model.general.Project")) {
        delete = method;
        break;
      }
    }
    if (delete == null) {
      throw new IllegalStateException("El repositorio no permite borrar items");
    }
    delete.invoke(repositoryFactory, project, viewObject);
  }

  /**
   * Define el schema (las columnas) de un nodo del job abierto.
   *
   * Un nodo sin schema no propaga columnas por la conexion, y el codigo
   * generado sale mal. Studio guarda el schema de cada nodo en su propio
   * `metadata` del `.item`.
   *
   * @param spec uniqueName del nodo y columns con name, type y opcionalmente
   *        length, precision, nullable y key.
   */
  public static Map<String, Object> setSchema(JsonObject spec) {
    return run("set-schema", () -> {
      Object editor = designerEditor(spec);
      Object process = processOf(editor);
      String uniqueName = required(spec, "uniqueName");
      Object node = nodeByUniqueName(process, uniqueName);
      if (node == null) {
        throw new IllegalStateException("No existe el nodo '" + uniqueName + "'");
      }

      Object table = createMetadataTable(spec, uniqueName);
      // La tabla tiene que ir colgada de un conector: sin `attachedConnector`
      // Studio no la serializa y el metadata se queda vacio en el `.item`.
      table.getClass().getMethod("setAttachedConnector", String.class)
          .invoke(table, connectorName(spec));
      node.getClass().getMethod("setMetadataList", List.class)
          .invoke(node, new ArrayList<Object>(java.util.Collections.singletonList(table)));
      // Los componentes con schema fijo (tFixedFlowInput) guardan ademas los
      // valores en una tabla: sin ella el job se ejecuta pero no saca datos.
      fillSchemaTable(node, rowsOf(spec));
      useDataTable(node);
      markModified(process);
      persist(process);

      Map<String, Object> summary = new LinkedHashMap<>();
      summary.put("uniqueName", uniqueName);
      summary.put("columns", arrayOf(spec, "columns").size());
      return summary;
    });
  }

  /**
   * Crea la tabla de metadata con las columnas pedidas.
   *
   * El `tableName` tiene que ser el unique name del nodo, como en los jobs que
   * escribe el IDE. Con otro nombre, Studio no serializa el metadata.
   *
   * Los tipos son los identificadores Java que acepta Talend: `id_String`,
   * `id_Integer`, `id_Long`, `id_Double`, `id_BigDecimal`, `id_Boolean`,
   * `id_Date`, etc.
   */
  private static Object createMetadataTable(JsonObject spec, String uniqueName) throws Exception {
    Class<?> tableClass = talendClass("org.talend.core.model.metadata.MetadataTable");
    Object table = tableClass.getConstructor().newInstance();

    Class<?> columnClass = talendClass("org.talend.core.model.metadata.MetadataColumn");
    Object columnPrototype = columnClass.getConstructor().newInstance();

    List<Object> columns = new ArrayList<>();
    for (JsonObject column : arrayOf(spec, "columns")) {
      String name = required(column, "name");
      Object newColumn = columnClass.getConstructor().newInstance();
      newColumn.getClass().getMethod("setLabel", String.class).invoke(newColumn, name);
      newColumn.getClass().getMethod("setId", String.class).invoke(newColumn, name);
      newColumn.getClass().getMethod("setType", String.class)
          .invoke(newColumn, normalizeColumnType(string(column, "type")));
      newColumn.getClass().getMethod("setTalendType", String.class)
          .invoke(newColumn, normalizeColumnType(string(column, "type")));
      newColumn.getClass().getMethod("setNullable", boolean.class)
          .invoke(newColumn, column.has("nullable") ? column.get("nullable").getAsBoolean() : true);
      newColumn.getClass().getMethod("setKey", boolean.class)
          .invoke(newColumn, column.has("key") ? column.get("key").getAsBoolean() : false);
      newColumn.getClass().getMethod("setLength", Integer.class)
          .invoke(newColumn, column.has("length") ? column.get("length").getAsInt() : Integer.valueOf(-1));
      newColumn.getClass().getMethod("setPrecision", Integer.class)
          .invoke(newColumn, column.has("precision") ? column.get("precision").getAsInt() : Integer.valueOf(-1));
      newColumn.getClass().getMethod("setOriginalLength", Integer.class)
          .invoke(newColumn, Integer.valueOf(-1));
      newColumn.getClass().getMethod("setPattern", String.class).invoke(newColumn, "");
      newColumn.getClass().getMethod("setComment", String.class).invoke(newColumn, "");
      newColumn.getClass().getMethod("setSourceType", String.class).invoke(newColumn, "");
      newColumn.getClass().getMethod("setUsefulColumn", boolean.class).invoke(newColumn, true);
      columns.add(newColumn);
    }

    table.getClass().getMethod("setListColumns", List.class).invoke(table, columns);
    table.getClass().getMethod("setTableName", String.class).invoke(table, uniqueName);
    return table;
  }

  /**
   * Filas de datos que se guardan en la tabla del componente.
   *
   * Se leen del parametro `values` del spec: una lista de filas, cada fila con
   * un valor por columna. Si no hay `values`, se crea una fila vacia.
   */
  private static List<List<String>> rowsOf(JsonObject spec) {
    List<List<String>> filas = new ArrayList<>();
    JsonElement raw = spec.get("values");
    if (raw == null || !raw.isJsonArray()) {
      return filas;
    }
    for (JsonElement row : raw.getAsJsonArray()) {
      List<String> valores = new ArrayList<>();
      if (row.isJsonArray()) {
        for (JsonElement value : row.getAsJsonArray()) {
          valores.add(value.isJsonNull() ? "" : value.getAsString());
        }
      } else if (row.isJsonPrimitive()) {
        valores.add(row.getAsString());
      }
      filas.add(valores);
    }
    return filas;
  }

  /**
   * Rellena las tablas del componente con el schema y los datos.
   *
   * Los componentes con schema fijo (tFixedFlowInput) guardan el schema y los
   * datos en dos tablas de tipo TABLE:
   *
   * - la de codigos `SCHEMA_COLUMN`/`VALUE` define las columnas y su valor por
   *   defecto;
   * - la que tiene `columnsBasedOnSchema` (INTABLE) guarda los registros: una
   *   fila por registro, con una entrada por columna.
   *
   * Los valores se escriben como literales Java, que es lo que espera el
   * generador de codigo: las cadenas van entre comillas.
   *
   * El formato de una tabla es una lista de mapas: cada mapa es una fila y
   * sus claves son los codigos de columna de la tabla. Talend lo serializa
   * como `elementValue` dentro del `elementParameter` de tipo TABLE.
   */
  private static void fillSchemaTable(Object node, List<List<String>> filas) throws Exception {
    List<Columna> columnas = new ArrayList<>();
    Object metadataList = node.getClass().getMethod("getMetadataList").invoke(node);
    if (metadataList instanceof Iterable) {
      for (Object table : (Iterable<?>) metadataList) {
        Object listColumns = table.getClass().getMethod("getListColumns").invoke(table);
        if (listColumns instanceof Iterable) {
          for (Object column : (Iterable<?>) listColumns) {
            columnas.add(new Columna(
                String.valueOf(column.getClass().getMethod("getLabel").invoke(column)),
                columnTypeOf(column)));
          }
        }
      }
    }
    if (columnas.isEmpty()) {
      return;
    }

    for (Object parameter : (List<?>) node.getClass().getMethod("getElementParameters").invoke(node)) {
      Object fieldType = parameter.getClass().getMethod("getFieldType").invoke(parameter);
      if (fieldType == null || !"TABLE".equals(String.valueOf(fieldType))) {
        continue;
      }
      Object codes = parameter.getClass().getMethod("getListItemsDisplayCodeName").invoke(parameter);
      List<String> columnCodes = new ArrayList<>();
      if (codes instanceof Object[]) {
        for (Object code : (Object[]) codes) {
          columnCodes.add(String.valueOf(code));
        }
      }
      boolean basedOnSchema = Boolean.TRUE.equals(
          parameter.getClass().getMethod("isColumnsBasedOnSchema").invoke(parameter));

      if (columnCodes.contains("SCHEMA_COLUMN")) {
        // Tabla de definicion de columnas: una entrada por columna.
        List<Object> rows = new ArrayList<>();
        for (int indiceColumna = 0; indiceColumna < columnas.size(); indiceColumna++) {
          Columna columna = columnas.get(indiceColumna);
          Map<String, Object> row = new LinkedHashMap<>();
          row.put("SCHEMA_COLUMN", columna.nombre);
          if (columnCodes.contains("VALUE")) {
            String valor = "";
            if (!filas.isEmpty() && indiceColumna < filas.get(0).size()) {
              valor = javaLiteral(filas.get(0).get(indiceColumna), columna.tipo);
            }
            row.put("VALUE", valor);
          }
          rows.add(row);
        }
        parameter.getClass().getMethod("setValue", Object.class).invoke(parameter, rows);
        continue;
      }

      if (basedOnSchema) {
        // Tabla de datos: una fila por registro, con una clave por columna.
        // Los codigos de la tabla los pone el componente a partir del schema,
        // pero si todavia estan vacios se rellenan aqui.
        if (columnCodes.isEmpty()) {
          String[] nombres = new String[columnas.size()];
          for (int i = 0; i < columnas.size(); i++) {
            nombres[i] = columnas.get(i).nombre;
          }
          try {
            parameter.getClass().getMethod("setListItemsDisplayCodeName", String[].class)
                .invoke(parameter, (Object) nombres);
          } catch (Exception e) {
            BridgeLog.warn("No se pudieron fijar los codigos de la tabla de datos", e);
          }
        }
        List<Object> rows = new ArrayList<>();
        for (List<String> valores : filas) {
          Map<String, Object> row = new LinkedHashMap<>();
          for (int indiceColumna = 0; indiceColumna < columnas.size(); indiceColumna++) {
            Columna columna = columnas.get(indiceColumna);
            String valor = indiceColumna < valores.size() ? valores.get(indiceColumna) : "";
            row.put(columna.nombre, javaLiteral(valor, columna.tipo));
          }
          rows.add(row);
        }
        parameter.getClass().getMethod("setValue", Object.class).invoke(parameter, rows);
      }
    }
  }

  /**
   * Pone el componente en modo "tabla de datos".
   *
   * Los componentes con schema fijo (tFixedFlowInput) tienen tres modos:
   * single (un valor), intable (las filas de una tabla) e inline (un texto).
   * Por defecto nacen en single, asi que los datos de la tabla se ignoran.
   */
  private static void useDataTable(Object node) {
    setParameterValue(node, "USE_SINGLEMODE", "false");
    setParameterValue(node, "USE_INTABLE", "true");
  }

  /** Cambia el valor de un parametro del nodo, si existe. */
  private static void setParameterValue(Object node, String name, String value) {
    try {
      Object parameter = node.getClass().getMethod("getElementParameter", String.class).invoke(node, name);
      if (parameter == null) {
        return;
      }
      parameter.getClass().getMethod("setValue", Object.class).invoke(parameter, value);
    } catch (Exception e) {
      BridgeLog.warn("No se pudo cambiar el parametro '" + name + "'", e);
    }
  }

  /**
   * Tipo Java de una columna del schema.
   *
   * El tipo util es el `talendType`: el `type` de la columna de metadata suele
   * venir vacio y el que se serializa en el `.item` es el otro.
   */
  private static String columnTypeOf(Object column) {
    try {
      Object talendType = column.getClass().getMethod("getTalendType").invoke(column);
      if (talendType != null && !String.valueOf(talendType).trim().isEmpty()) {
        return String.valueOf(talendType);
      }
    } catch (Exception e) {
      // Se prueba con el type.
    }
    try {
      Object type = column.getClass().getMethod("getType").invoke(column);
      return type == null ? "" : String.valueOf(type);
    } catch (Exception e) {
      return "";
    }
  }

  /** Columna del schema: nombre y tipo Java. */
  private static final class Columna {
    private final String nombre;
    private final String tipo;

    Columna(String nombre, String tipo) {
      this.nombre = nombre;
      this.tipo = tipo;
    }
  }

  /**
   * Convierte un valor en el literal Java que espera el codigo generado.
   *
   * Las cadenas van entre comillas: el generador escribe el valor tal cual en
   * el codigo, asi que un texto sin comillas no compila.
   */
  private static String javaLiteral(String value, String type) {
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
    return trimmed;
  }

  /** Convierte una fecha `yyyy-MM-dd[ HH:mm:ss]` a milisegundos. */
  private static Long dateToMillis(String value) {
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

  /**
   * Tipos Java de columna que acepta Talend.
   *
   * Un id que no existe hace fallar la generacion de codigo con
   * `Unknown java id type`. Ver docs/TALEND-STUDIO-INTERNALS.md.
   */
  private static String normalizeColumnType(String type) {
    if (type == null || type.trim().isEmpty()) {
      return "id_String";
    }
    if (TALEND_COLUMN_TYPES.contains(type)) {
      return type;
    }
    String alias = COLUMN_TYPE_ALIASES.get(type.toLowerCase());
    return alias != null ? alias : "id_String";
  }

  /** Tipos Java validos de columna. */
  private static final java.util.Set<String> TALEND_COLUMN_TYPES = new java.util.HashSet<>(
      java.util.Arrays.asList("id_String", "id_Integer", "id_Long", "id_Double", "id_Float",
          "id_BigDecimal", "id_Boolean", "id_Byte", "id_Short", "id_Character", "id_Date",
          "id_Password", "id_Dynamic"));

  /** Alias en ingles de los tipos Java de columna. */
  private static final Map<String, String> COLUMN_TYPE_ALIASES = new java.util.HashMap<>();

  static {
    COLUMN_TYPE_ALIASES.put("string", "id_String");
    COLUMN_TYPE_ALIASES.put("text", "id_String");
    COLUMN_TYPE_ALIASES.put("varchar", "id_String");
    COLUMN_TYPE_ALIASES.put("char", "id_Character");
    COLUMN_TYPE_ALIASES.put("int", "id_Integer");
    COLUMN_TYPE_ALIASES.put("integer", "id_Integer");
    COLUMN_TYPE_ALIASES.put("long", "id_Long");
    COLUMN_TYPE_ALIASES.put("bigint", "id_Long");
    COLUMN_TYPE_ALIASES.put("double", "id_Double");
    COLUMN_TYPE_ALIASES.put("float", "id_Float");
    COLUMN_TYPE_ALIASES.put("real", "id_Double");
    COLUMN_TYPE_ALIASES.put("decimal", "id_BigDecimal");
    COLUMN_TYPE_ALIASES.put("numeric", "id_BigDecimal");
    COLUMN_TYPE_ALIASES.put("bigdecimal", "id_BigDecimal");
    COLUMN_TYPE_ALIASES.put("boolean", "id_Boolean");
    COLUMN_TYPE_ALIASES.put("bool", "id_Boolean");
    COLUMN_TYPE_ALIASES.put("byte", "id_Byte");
    COLUMN_TYPE_ALIASES.put("short", "id_Short");
    COLUMN_TYPE_ALIASES.put("date", "id_Date");
    COLUMN_TYPE_ALIASES.put("datetime", "id_Date");
    COLUMN_TYPE_ALIASES.put("timestamp", "id_Date");
    COLUMN_TYPE_ALIASES.put("password", "id_Password");
  }

  /**
   * Anade un nodo al job abierto.
   *
   * @param spec componente: type, label, position, parameters.
   */
  public static Map<String, Object> addNode(JsonObject spec) {
    return run("add-node", () -> {
      Object editor = designerEditor(spec);
      if (editor == null) {
        throw new IllegalStateException("No hay ningun job abierto en el editor");
      }
      String componentName = required(spec, "type");
      Object catalogComponent = findCatalogComponent(componentName);
      if (catalogComponent == null) {
        throw new IllegalStateException(
            "Componente '" + componentName + "' no encontrado en el catalogo de Talend");
      }

      // Node(component) es lo que hace el palette de Studio al soltar el
      // componente: crea el nodo con la definicion del componente.
      Class<?> nodeClass = talendClass("org.talend.designer.core.ui.editor.nodes.Node");
      Object node = nodeClass
          .getConstructor(talendClass("org.talend.core.model.components.IComponent"))
          .newInstance(catalogComponent);

      // El nodo nace sin parametros: hay que pedirle al componente que los
      // cree. Es lo que hace el editor al soltar el componente en el lienzo, y
      // es de donde salen los valores por defecto (ENCODING, FIELDSEPARATOR,
      // el schema fijo de tFixedFlowInput...).
      createComponentParameters(nodeClass, node);

      Object process = processOf(editor);

      // El nombre unico lo genera el proceso. El comando de alta solo lo
      // registra: si el parametro UNIQUE_NAME se queda vacio, el nodo no se
      // serializa y no se puede referenciar en una conexion.
      assignUniqueName(process, node);

      // El nodo entra en el proceso dentro de un NodeContainer, que es lo que
      // hace el comando de alta del editor.
      Class<?> containerClass = talendClass(
          "org.talend.designer.core.ui.editor.nodecontainer.NodeContainer");
      Object nodeContainer = containerClass.getConstructor(nodeClass).newInstance(node);

      Class<?> commandClass = talendClass(
          "org.talend.designer.core.ui.editor.cmd.CreateNodeContainerCommand");
      Command command = (Command) commandClass
          .getConstructor(talendClass("org.talend.designer.core.ui.editor.process.Process"),
              containerClass, Point.class)
          .newInstance(process, nodeContainer, positionOf(spec));

      // El command stack es quien registra el nodo en el modelo y lo dibuja.
      Object commandStack = editor.getClass().getMethod("getCommandStack").invoke(editor);
      commandStack.getClass().getMethod("execute", Command.class).invoke(commandStack, command);

      applyParameters(node, spec);
      String label = string(spec, "label");
      if (label != null) {
        node.getClass().getMethod("setLabel", String.class).invoke(node, label);
      }
      markModified(process);
      persist(process);
      return nodeSummary(node);
    });
  }

  /**
   * Conecta dos nodos del job abierto.
   *
   * @param spec source, target y type del conector.
   */
  public static Map<String, Object> connect(JsonObject spec) {
    return run("connect", () -> {
      Object editor = designerEditor(spec);
      if (editor == null) {
        throw new IllegalStateException("No hay ningun job abierto en el editor");
      }
      Object process = processOf(editor);
      String sourceName = required(spec, "source");
      String targetName = required(spec, "target");

      Object source = nodeByUniqueName(process, sourceName);
      Object target = nodeByUniqueName(process, targetName);
      if (source == null) {
        throw new IllegalStateException("No existe el nodo origen '" + sourceName + "'");
      }
      if (target == null) {
        throw new IllegalStateException("No existe el nodo destino '" + targetName + "'");
      }

      // ConnectionCreateCommand es el comando que usa el editor al arrastrar
      // una conexion entre dos nodos.
      //
      // Su tercer argumento no es una lista cualquiera: el constructor lee
      // los tres primeros elementos sin comprobar nada, asi que la lista no
      // puede ir vacia. Son el nombre del schema de la conexion, el nombre de
      // la conexion y la metadata que viaja.
      java.util.List<Object> meta = new ArrayList<>();
      meta.add(sourceName);
      meta.add(connectionName(spec));
      meta.add(null);

      Class<?> commandClass = talendClass("org.talend.designer.core.ui.editor.cmd.ConnectionCreateCommand");
      Object command = commandClass
          .getConstructor(talendClass("org.talend.designer.core.ui.editor.nodes.Node"),
              String.class, List.class)
          .newInstance(source, connectorOf(spec), meta);
      commandClass.getMethod("setTarget", talendClass("org.talend.designer.core.ui.editor.nodes.Node"))
          .invoke(command, target);
      // La conexion se ejecuta por el command stack, igual que cuando se
      // arrastra con el raton. Si se llama a `execute()` directamente el
      // editor no se marca como modificado y el guardado se salta la
      // conexion.
      Object commandStack = editor.getClass().getMethod("getCommandStack").invoke(editor);
      commandStack.getClass().getMethod("execute", Command.class).invoke(commandStack, command);
      markModified(process);
      persist(process);

      Map<String, Object> summary = new LinkedHashMap<>();
      summary.put("source", sourceName);
      summary.put("target", targetName);
      summary.put("connector", connectorOf(spec));
      return summary;
    });
  }

  /**
   * Cambia los parametros de un nodo del job abierto.
   *
   * @param spec uniqueName del nodo y parameters a cambiar.
   */
  public static Map<String, Object> updateNode(JsonObject spec) {
    return run("update-node", () -> {
      Object editor = designerEditor(spec);
      if (editor == null) {
        throw new IllegalStateException("No hay ningun job abierto en el editor");
      }
      Object process = processOf(editor);
      String uniqueName = required(spec, "uniqueName");
      Object node = nodeByUniqueName(process, uniqueName);
      if (node == null) {
        throw new IllegalStateException("No existe el nodo '" + uniqueName + "'");
      }

      applyParameters(node, spec);
      String label = string(spec, "label");
      if (label != null) {
        node.getClass().getMethod("setLabel", String.class).invoke(node, label);
      }
      markModified(process);
      persist(process);
      return nodeSummary(node);
    });
  }

  /**
   * Borra nodos del job abierto.
   *
   * @param spec uniqueNames de los nodos a borrar.
   */
  public static Map<String, Object> deleteNodes(JsonObject spec) {
    return run("delete-nodes", () -> {
      Object editor = designerEditor(spec);
      if (editor == null) {
        throw new IllegalStateException("No hay ningun job abierto en el editor");
      }
      Object process = processOf(editor);

      List<Object> nodes = new ArrayList<>();
      List<String> removed = new ArrayList<>();
      for (String uniqueName : stringList(spec, "uniqueNames")) {
        Object node = nodeByUniqueName(process, uniqueName);
        if (node == null) {
          continue;
        }
        nodes.add(node);
        removed.add(uniqueName);
      }
      if (nodes.isEmpty()) {
        throw new IllegalStateException("No se encontro ningun nodo a borrar");
      }

      // DeleteNodeContainerCommand es el comando que usa el editor al
      // seleccionar un nodo y pulsar suprimir.
      Class<?> commandClass = talendClass("org.talend.designer.core.ui.editor.cmd.DeleteNodeContainerCommand");
      Object command = commandClass
          .getConstructor(talendClass("org.talend.core.model.process.IProcess2"), List.class)
          .newInstance(process, nodes);
      commandClass.getMethod("execute").invoke(command);

      Map<String, Object> summary = new LinkedHashMap<>();
      summary.put("removed", removed);
      return summary;
    });
  }

  /**
   * Copia un nodo del job abierto.
   *
   * @param spec uniqueName del nodo y opcionalmente newUniqueName.
   */
  public static Map<String, Object> copyNode(JsonObject spec) {
    return run("copy-node", () -> {
      Object editor = designerEditor(spec);
      if (editor == null) {
        throw new IllegalStateException("No hay ningun job abierto en el editor");
      }
      Object process = processOf(editor);
      String uniqueName = required(spec, "uniqueName");
      Object node = nodeByUniqueName(process, uniqueName);
      if (node == null) {
        throw new IllegalStateException("No existe el nodo '" + uniqueName + "'");
      }

      // NodesPasteCommand es el comando que usa el editor al copiar y pegar
      // un nodo.
      Class<?> commandClass = talendClass("org.talend.designer.core.ui.editor.cmd.NodesPasteCommand");
      Object command = commandClass
          .getConstructor(List.class, talendClass("org.talend.core.model.process.IProcess2"), Point.class)
          .newInstance(new ArrayList<Object>(), process, positionOf(spec));

      // El comando de pegado trabaja con NodePart, no con el modelo. Se crea
      // la parte grafica del nodo original, que es lo que el portapapeles
      // guarda.
      Object nodePart = nodePartOf(editor, node);
      List<Object> parts = new ArrayList<>();
      parts.add(nodePart);
      commandClass.getConstructor(List.class, talendClass("org.talend.core.model.process.IProcess2"), Point.class)
          .newInstance(parts, process, positionOf(spec));
      commandClass.getMethod("execute").invoke(command);

      Map<String, Object> summary = new LinkedHashMap<>();
      summary.put("copied", uniqueName);
      return summary;
    });
  }

  /**
   * Lista los nodos del job abierto.
   *
   * @param spec opcional, con `job` para abrir el job si no esta abierto.
   */
  public static Map<String, Object> listNodes(JsonObject spec) {
    return run("list-nodes", () -> {
      Object editor = designerEditor(spec);
      if (editor == null) {
        throw new IllegalStateException("No hay ningun job abierto en el editor");
      }
      Object process = processOf(editor);
      List<Map<String, Object>> nodes = new ArrayList<>();
      // `getGraphicalNodes` son los nodos del lienzo, que incluyen los que
      // no son nodos de proceso (los subjobs, por ejemplo).
      Object processNodes = process.getClass().getMethod("getGraphicalNodes").invoke(process);
      if (processNodes instanceof Iterable) {
        for (Object node : (Iterable<?>) processNodes) {
          nodes.add(nodeSummary(node));
        }
      }
      return nodes;
    });
  }

  // ---------------------------------------------------------------------
  // Acceso a la API de Talend
  // ---------------------------------------------------------------------

  /** `XmiResourceManager` de Talend, por donde se crean los recursos EMF. */
  private static Object xmiResourceManager() throws Exception {
    Class<?> proxyFactoryClass = talendClass("org.talend.core.repository.model.ProxyRepositoryFactory");
    Object proxyFactory = proxyFactoryClass.getMethod("getInstance").invoke(null);
    return proxyFactoryClass.getMethod("getXmiResourceManager").invoke(proxyFactory);
  }

  /**
   * Busca un job cualquiera del proyecto, para usarlo de base al crear otro.
   *
   * Se recorre el arbol de archivos del proyecto: el repositorio no ofrece un
   * listado fiable, pero el `.properties` de cada job tiene su id interno.
   */
  private static Object findAnyJob(Object repositoryFactory, Object project) {
    try {
      IProject iProject = resourceProject();
      if (iProject == null) {
        return null;
      }
      org.eclipse.core.resources.IFolder processFolder = iProject.getFolder("process");
      if (!processFolder.exists()) {
        return null;
      }
      for (org.eclipse.core.resources.IResource member : processFolder.members()) {
        if (!(member instanceof org.eclipse.core.resources.IContainer)) {
          continue;
        }
        java.util.List<org.eclipse.core.resources.IFile> files = new java.util.ArrayList<>();
        ((org.eclipse.core.resources.IContainer) member).accept(new org.eclipse.core.resources.IResourceVisitor() {
          @Override
          public boolean visit(org.eclipse.core.resources.IResource resource) {
            if (resource instanceof org.eclipse.core.resources.IFile) {
              files.add((org.eclipse.core.resources.IFile) resource);
            }
            return true;
          }
        });
        for (org.eclipse.core.resources.IFile file : files) {
          if (!file.getName().endsWith(".properties")) {
            continue;
          }
          String id = readInternalId(file);
          if (id == null) {
            continue;
          }
          Object viewObject = repositoryFactory.getClass()
              .getMethod("getSpecificVersion", talendClass("org.talend.core.model.general.Project"),
                  String.class, String.class, boolean.class)
              .invoke(repositoryFactory, project, id, "0.1", false);
          if (viewObject == null) {
            continue;
          }
          Object property = viewObject.getClass()
              .getMethod("getProperty", talendClass("org.talend.core.model.properties.Property"))
              .invoke(viewObject);
          return property.getClass()
              .getMethod("getItem", talendClass("org.talend.core.model.properties.Item"))
              .invoke(property);
        }
      }
    } catch (Exception e) {
      BridgeLog.warn("No se pudo buscar un job de ejemplo en el proyecto", e);
    }
    return null;
  }

  /** Lee el id interno de un job del atributo `id` de su `.properties`. */
  private static String readInternalId(org.eclipse.core.resources.IFile file) {
    try {
      String xml = new String(java.nio.file.Files.readAllBytes(
          file.getLocation().toPath()), java.nio.charset.StandardCharsets.UTF_8);
      java.util.regex.Matcher matcher = java.util.regex.Pattern
          .compile("Property xmi:id=\"[^\"]+\"\\s+id=\"([^\"]+)\"").matcher(xml);
      return matcher.find() ? matcher.group(1) : null;
    } catch (Exception e) {
      return null;
    }
  }

  /** Identificador unico con el formato que usa Talend. */
  private static String generateId() {
    return "_" + Long.toHexString(System.nanoTime());
  }

  /** Repositorio de Talend del proyecto abierto. */
  private static Object repositoryFactory() throws Exception {
    Object plugin = talendClass("org.talend.core.runtime.CoreRuntimePlugin")
        .getMethod("getInstance").invoke(null);
    return plugin.getClass().getMethod("getProxyRepositoryFactory").invoke(plugin);
  }

  /** Proyecto de Talend abierto. */
  private static Object currentProject() throws Exception {
    Class<?> projectManagerClass = talendClass("org.talend.repository.ProjectManager");
    Object projectManager = projectManagerClass.getMethod("getInstance").invoke(null);
    return projectManagerClass.getMethod("getCurrentProject").invoke(projectManager);
  }

  /**
   * Ruta de la carpeta del item para el repositorio.
   *
   * El repositorio antepone la carpeta del tipo de objeto (`process`) y crea
   * dentro los tres archivos del job: `.item`, `.properties` y `.screenshot`.
   * Por eso la ruta es solo el nombre de la carpeta, sin `process` delante.
   *
   * El `createItemResource` del `XmiResourceManager` si espera la ruta completa
   * (`process/MiJob`), porque el recurso se crea ahi.
   */
  private static org.eclipse.core.runtime.IPath processPath(String folder, String name, String version)
      throws Exception {
    org.eclipse.core.runtime.IPath path = org.eclipse.core.runtime.Path.fromOSString(name);
    if (folder != null && !folder.trim().isEmpty()) {
      for (String part : folder.split("/")) {
        if (!part.trim().isEmpty()) {
          path = path.append(part);
        }
      }
    }
    return path;
  }

  /**
   * Ruta completa del item, con la carpeta del tipo de objeto.
   *
   * Es la que espera `XmiResourceManager.createItemResource`.
   */
  private static org.eclipse.core.runtime.IPath itemResourcePath(String folder, String name,
      String version) throws Exception {
    return org.eclipse.core.runtime.Path.fromOSString("process").append(processPath(folder, name, version));
  }

  /** Proyecto de Eclipse que corresponde al proyecto de Talend abierto. */
  private static IProject resourceProject() throws Exception {
    Class<?> projectManagerClass = talendClass("org.talend.repository.ProjectManager");
    Object projectManager = projectManagerClass.getMethod("getInstance").invoke(null);
    Object project = projectManagerClass.getMethod("getCurrentProject").invoke(projectManager);
    Object emfProject = project.getClass().getMethod("getEmfProject").invoke(project);
    return (IProject) projectManagerClass
        .getMethod("getResourceProject", talendClass("org.talend.core.model.properties.Project"))
        .invoke(projectManager, emfProject);
  }

  /**
   * Abre el job recien creado en el editor.
   *
   * Se abre por su ruta en disco, dentro del proyecto de Eclipse. El item
   * puede estar recien creado y el arbol de recursos de Eclipse todavia no lo
   * conoce, asi que antes se refresca el ancestro.
   */
  private static Map<String, Object> openCreatedJob(Object processItem, String name, String version)
      throws Exception {
    IProject iProject = resourceProject();
    if (iProject == null) {
      Map<String, Object> payload = new LinkedHashMap<>();
      payload.put("opened", false);
      payload.put("error", "No se pudo localizar el proyecto de Eclipse");
      return payload;
    }

    // El repositorio crea una carpeta por job, con los tres archivos dentro.
    org.eclipse.core.resources.IFolder jobFolder = iProject.getFolder("process").getFolder(name);
    jobFolder.refreshLocal(org.eclipse.core.resources.IResource.DEPTH_ZERO, null);
    org.eclipse.core.resources.IFile file = jobFolder.getFile(name + "_" + version + ".item");
    if (!file.exists()) {
      Map<String, Object> payload = new LinkedHashMap<>();
      payload.put("opened", false);
      payload.put("error", "El item recien creado no esta en el arbol de recursos");
      return payload;
    }

    return WorkbenchService.openResource(file.getLocation().toOSString());
  }

  /** Editor grafico del job abierto. */
  /**
   * Abre un job del proyecto en el editor.
   *
   * Las operaciones sobre nodos necesitan el editor abierto: un proceso creado
   * aparte es una copia y lo que se modifique en el no llega al disco.
   *
   * @param spec name del job y opcionalmente version y folder.
   */
  public static Map<String, Object> openJob(JsonObject spec) {
    return run("open-job", () -> {
      String name = required(spec, "name");
      String version = string(spec, "version");
      if (version == null || version.trim().isEmpty()) {
        version = "0.1";
      }

      IProject iProject = resourceProject();
      if (iProject == null) {
        throw new IllegalStateException("No se pudo localizar el proyecto de Eclipse");
      }

      // El repositorio crea una carpeta por job, con los tres archivos dentro.
      org.eclipse.core.resources.IFolder jobFolder = iProject.getFolder("process").getFolder(name);
      jobFolder.refreshLocal(org.eclipse.core.resources.IResource.DEPTH_ZERO, null);
      org.eclipse.core.resources.IFile file = jobFolder.getFile(name + "_" + version + ".item");
      if (!file.exists()) {
        throw new IllegalStateException("No existe el job '" + name + "' en el proyecto");
      }

      Map<String, Object> opened = WorkbenchService.openResource(file.getLocation().toOSString());
      if (!Boolean.TRUE.equals(opened.get("opened"))) {
        throw new IllegalStateException("No se pudo abrir el job: " + opened.get("error"));
      }
      return opened;
    });
  }

  /**
   * Editor grafico del job abierto.
   *
   * Si no hay ningun job abierto, se abre el job indicado en el spec, para
   * que las operaciones no dependan de que alguien lo haya abierto antes.
   */
  private static Object designerEditor(JsonObject spec) throws Exception {
    org.eclipse.ui.IEditorPart editor = WorkbenchService.activeEditorPart();
    if (editor == null) {
      // El spec puede decir que job es. Sin el, se toma el unico job del
      // proyecto abierto, que es lo habitual.
      String jobName = string(spec, "job");
      if (jobName == null) {
        throw new IllegalStateException(
            "No hay ningun job abierto: indica 'job' en la peticion");
      }
      JsonObject jobSpec = new JsonObject();
      jobSpec.addProperty("name", jobName);
      String version = string(spec, "version");
      if (version != null) {
        jobSpec.addProperty("version", version);
      }
      openJob(jobSpec);
      editor = WorkbenchService.activeEditorPart();
      if (editor == null) {
        throw new IllegalStateException("No se pudo abrir el job en el editor");
      }
    }
    Object designer = editor.getClass().getMethod("getDesignerEditor").invoke(editor);
    return designer != null ? designer : editor;
  }

  /** Proceso (job) abierto en el editor. */
  private static Object processOf(Object editor) throws Exception {
    Object process = editor.getClass().getMethod("getProcess").invoke(editor);
    if (process == null) {
      throw new IllegalStateException("El editor no tiene un proceso cargado");
    }
    return process;
  }

  /**
   * Pone el nombre unico al nodo, que es el que usa Talend para nombrarlo.
   *
   * El proceso lo genera (`generateUniqueNodeName`) y el comando de alta solo
   * lo registra. Si el parametro `UNIQUE_NAME` se queda vacio, el nodo no se
   * serializa en el `.item` y no se puede referenciar al conectar.
   */
  private static void assignUniqueName(Object process, Object node) {
    try {
      Object parameter = node.getClass().getMethod("getElementParameter", String.class)
          .invoke(node, "UNIQUE_NAME");
      if (parameter == null) {
        BridgeLog.warn("El componente no tiene parametro UNIQUE_NAME");
        return;
      }
      Object current = parameter.getClass().getMethod("getValue").invoke(parameter);
      if (current != null && !String.valueOf(current).trim().isEmpty()) {
        return;
      }
      Object generated = process.getClass()
          .getMethod("generateUniqueNodeName", talendClass("org.talend.core.model.process.INode"))
          .invoke(process, node);
      if (generated == null) {
        return;
      }
      parameter.getClass().getMethod("setValue", Object.class)
          .invoke(parameter, String.valueOf(generated));
    } catch (Exception e) {
      BridgeLog.warn("No se pudo asignar el nombre unico al nodo", e);
    }
  }

  /**
   * Pide al componente que cree sus parametros.
   *
   * Un `Node` recien creado no tiene parametros: los crea el componente a
   * partir de su definicion. Sin este paso el nodo se queda sin `ENCODING`,
   * `FIELDSEPARATOR` y el schema fijo de los componentes que lo traen.
   *
   * El metodo no es publico, asi que se busca entre los declarados.
   */
  private static void createComponentParameters(Class<?> nodeClass, Object node) {
    try {
      java.lang.reflect.Method create = null;
      for (java.lang.reflect.Method method : nodeClass.getDeclaredMethods()) {
        if ("createElementParameters".equals(method.getName()) && method.getParameterCount() == 0) {
          create = method;
          break;
        }
      }
      if (create == null) {
        BridgeLog.warn("El nodo no tiene metodo para crear sus parametros");
        return;
      }
      create.setAccessible(true);
      create.invoke(node);
    } catch (Exception e) {
      BridgeLog.warn("No se pudieron crear los parametros del componente", e);
    }
  }

  /** Parte grafica de un nodo, que es lo que guarda el portapapeles. */
  private static Object nodePartOf(Object editor, Object node) throws Exception {
    Object viewer = editor.getClass().getMethod("getViewer").invoke(editor);
    if (viewer == null) {
      return null;
    }
    Object parts = viewer.getClass().getMethod("getEditParts").invoke(viewer);
    if (parts instanceof Iterable) {
      for (Object part : (Iterable<?>) parts) {
        Object model = part.getClass().getMethod("getModel").invoke(part);
        if (model == node) {
          return part;
        }
      }
    }
    return null;
  }

  /** Nodo del proceso por su unique name. */
  private static Object nodeByUniqueName(Object process, String uniqueName) throws Exception {
    Object nodes = process.getClass().getMethod("getGraphicalNodes").invoke(process);
    if (nodes instanceof Iterable) {
      for (Object node : (Iterable<?>) nodes) {
        Object name = node.getClass().getMethod("getUniqueName").invoke(node);
        if (uniqueName.equals(name)) {
          return node;
        }
      }
    }
    return null;
  }

  /** Aplica los parametros que pide el usuario sobre los del componente. */
  private static void applyParameters(Object node, JsonObject spec) throws Exception {
    for (Map.Entry<String, JsonElement> entry : objectOf(spec, "parameters").entrySet()) {
      JsonElement raw = entry.getValue();
      if (!raw.isJsonObject()) {
        continue;
      }
      String value = string(raw.getAsJsonObject(), "value");
      if (value == null) {
        continue;
      }
      Object parameter = node.getClass().getMethod("getElementParameter", String.class)
          .invoke(node, entry.getKey());
      if (parameter == null) {
        // El componente no tiene ese parametro: se avisa, no se falla.
        BridgeLog.warn("El componente no tiene el parametro '" + entry.getKey() + "'");
        continue;
      }
      parameter.getClass().getMethod("setValue", Object.class).invoke(parameter, value);
    }
  }

  /**
   * Guarda el modelo del job en el `.item`.
   *
   * `editor.doSave()` no sirve para esto: aborta en seco si el editor no esta
   * "dirty" y ese indicador mira el estado de la UI, no el del modelo de
   * Talend. Con los cambios hechos por la API el editor queda limpio, asi que
   * el guardado no ocurria nunca.
   *
   * Ademas el `ProcessType` enlazado al recurso no es el que construye
   * Talend: las conexiones y el metadata de los nodos viven en el modelo
   * grafico y solo aparecen en el `ProcessType` que arma `saveXmlFile()`.
   * Por eso se toma ese resultado y se deja como contenido del recurso.
   *
   * Ver docs/TALEND-STUDIO-INTERNALS.md, seccion "Guardar el job".
   */
  private static void persist(Object process) {
    try {
      Object nuevo = process.getClass().getMethod("saveXmlFile").invoke(process);
      if (nuevo == null) {
        return;
      }
      Object property = process.getClass().getMethod("getProperty").invoke(process);
      Object item = property.getClass().getMethod("getItem").invoke(property);
      if (item == null) {
        BridgeLog.warn("El proceso no tiene item: no se puede guardar");
        return;
      }
      Object processType = item.getClass().getMethod("getProcess").invoke(item);
      if (processType == null) {
        BridgeLog.warn("El item no tiene ProcessType: no se puede guardar");
        return;
      }
      Object resource = processType.getClass().getMethod("eResource").invoke(processType);
      if (resource == null) {
        BridgeLog.warn("El job no esta enlazado a un recurso EMF: no se puede guardar");
        return;
      }
      // El recurso del `.item` guarda un solo objeto raiz: el ProcessType.
      @SuppressWarnings("unchecked")
      java.util.List<Object> contents = (java.util.List<Object>) resource.getClass()
          .getMethod("getContents").invoke(resource);
      contents.clear();
      contents.add(nuevo);
      item.getClass()
          .getMethod("setProcess", talendClass(
              "org.talend.designer.core.model.utils.emf.talendfile.ProcessType"))
          .invoke(item, nuevo);
      resource.getClass().getMethod("save", java.util.Map.class).invoke(resource, new java.util.HashMap());
    } catch (Exception e) {
      BridgeLog.warn("No se pudo guardar el job en el .item", e);
    }
  }

  /**
   * Marca el proceso como modificado.
   *
   * Sin esto el editor no se considera dirty y el guardado no escribe nada:
   * cambiar un parametro no dispara por si solo el aviso de cambio.
   */
  private static void markModified(Object process) {
    try {
      process.getClass().getMethod("setProcessModified", boolean.class).invoke(process, Boolean.TRUE);
    } catch (Exception e) {
      BridgeLog.warn("No se pudo marcar el proceso como modificado", e);
    }
  }

  /**
   * Busca el componente en el catalogo de Talend.
   *
   * El catalogo vive en `IComponentsService`, que lo publica Talend.
   */
  private static Object findCatalogComponent(String componentName) throws Exception {
    Class<?> serviceClass = talendClass("org.talend.core.model.components.IComponentsService");
    Object service = serviceClass.getMethod("get").invoke(null);
    Object factory = service.getClass().getMethod("getComponentsFactory").invoke(service);
    Object components = factory.getClass().getMethod("getComponents").invoke(factory);
    if (components instanceof Set) {
      for (Object candidate : (Set<?>) components) {
        Object name = candidate.getClass().getMethod("getName").invoke(candidate);
        if (componentName.equals(name)) {
          return candidate;
        }
      }
    }
    return null;
  }

  private static Map<String, Object> nodeSummary(Object node) {
    Map<String, Object> summary = new LinkedHashMap<>();
    try {
      summary.put("uniqueName", node.getClass().getMethod("getUniqueName").invoke(node));
      summary.put("label", node.getClass().getMethod("getLabel").invoke(node));
      Object component = node.getClass().getMethod("getComponent").invoke(node);
      if (component != null) {
        summary.put("componentName", component.getClass().getMethod("getName").invoke(component));
      }
    } catch (Exception e) {
      // El resumen es informativo: si falla, no se rompe la operacion.
    }
    return summary;
  }

  // ---------------------------------------------------------------------
  // Utilidades
  // ---------------------------------------------------------------------

  private interface Operation {
    Object run() throws Exception;
  }

  private static Map<String, Object> run(String operation, Operation body) {
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("ok", true);
    payload.put("source", "studio-bridge");
    payload.put("confidence", "medium");
    payload.put("endpoint", "/automation/" + operation);
    try {
      Object result = body.run();
      payload.put("result", result);
    } catch (Exception e) {
      payload.put("ok", false);
      payload.put("error", "OPERATION_FAILED: " + describe(e));
      BridgeLog.warn("La operacion '" + operation + "' fallo", e);
    }
    return payload;
  }

  /** Nombre de la conexion, o uno por defecto si el usuario no lo da. */
  private static String connectionName(JsonObject spec) {
    String name = string(spec, "name");
    return name != null && !name.trim().isEmpty() ? name : "conn_1";
  }

  /** Conector al que cuelga la tabla de metadata. */
  private static String connectorName(JsonObject spec) {
    String connector = string(spec, "connector");
    return connector != null && !connector.trim().isEmpty() ? connector : "FLOW";
  }

  private static String connectorOf(JsonObject spec) {
    String connector = string(spec, "type");
    if (connector == null || connector.trim().isEmpty()) {
      connector = "FLOW";
    }
    return connector;
  }

  private static Point positionOf(JsonObject spec) {
    JsonObject position = objectOf(spec, "position");
    int x = position.has("x") ? position.get("x").getAsInt() : 128;
    int y = position.has("y") ? position.get("y").getAsInt() : 128;
    return new Point(x, y);
  }

  private static String required(JsonObject spec, String key) {
    String value = string(spec, key);
    if (value == null || value.trim().isEmpty()) {
      throw new IllegalArgumentException("Falta el parametro '" + key + "'");
    }
    return value;
  }

  private static String string(JsonObject object, String key) {
    if (object == null || !object.has(key) || object.get(key).isJsonNull()) {
      return null;
    }
    return object.get(key).getAsString();
  }

  /** Booleano del spec, con valor por defecto. */
  private static boolean booleanOf(JsonObject object, String key, boolean fallback) {
    if (object == null || !object.has(key) || object.get(key).isJsonNull()) {
      return fallback;
    }
    try {
      return object.get(key).getAsBoolean();
    } catch (RuntimeException e) {
      return fallback;
    }
  }

  private static JsonObject objectOf(JsonObject parent, String key) {
    if (parent == null || !parent.has(key) || !parent.get(key).isJsonObject()) {
      return new JsonObject();
    }
    return parent.getAsJsonObject(key);
  }

  /** Objetos de un array del spec, como lista. */
  private static List<JsonObject> arrayOf(JsonObject parent, String key) {
    List<JsonObject> items = new ArrayList<>();
    if (parent == null || !parent.has(key) || !parent.get(key).isJsonArray()) {
      return items;
    }
    for (JsonElement element : parent.getAsJsonArray(key)) {
      if (element.isJsonObject()) {
        items.add(element.getAsJsonObject());
      }
    }
    return items;
  }

  private static List<String> stringList(JsonObject parent, String key) {
    List<String> items = new ArrayList<>();
    if (parent == null || !parent.has(key) || !parent.get(key).isJsonArray()) {
      return items;
    }
    for (JsonElement element : parent.getAsJsonArray(key)) {
      if (element.isJsonPrimitive()) {
        items.add(element.getAsString());
      }
    }
    return items;
  }

  private static Class<?> talendClass(String className) throws ClassNotFoundException {
    org.osgi.framework.BundleContext context =
        org.eclipse.core.runtime.Platform.getBundle("org.talend.core.runtime").getBundleContext();
    for (org.osgi.framework.Bundle bundle : context.getBundles()) {
      try {
        return bundle.loadClass(className);
      } catch (ClassNotFoundException ignored) {
        // El bundle no tiene la clase: se prueba el siguiente.
      }
    }
    return Class.forName(className);
  }

  private static String describe(Exception e) {
    Throwable cause = e;
    while (cause.getCause() != null && cause.getCause() != cause) {
      cause = cause.getCause();
    }
    return cause.getMessage() != null ? cause.getMessage() : cause.toString();
  }
}
