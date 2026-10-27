package com.andres.talend.bridge.automation;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import com.andres.talend.bridge.BridgeLog;

import com.google.gson.JsonObject;

/**
 * Opera sobre el job abierto en Talend Studio con la API del propio IDE.
 *
 * Antes el MCP escribia el `.item` a mano. Eso obligaba a reproducir el
 * formato XML de Talend (context, metadata, LENGTHS, tipos Java) y a forzar
 * despues la recarga del modelo EMF, porque Studio no se entera de los
 * cambios hechos por fuera. Con esta API el modelo en memoria siempre es la
 * fuente de verdad y el formato lo pone Talend.
 *
 * Esta clase es la fachada: cada operacion vive en su propia clase
 * (`JobRepository`, `NodeOperations`, `SchemaOperations`, `JobPersistence`) y
 * aqui solo se coordinan y se envuelven en el sobre de respuesta.
 */
public final class JobOperationsService {

  private JobOperationsService() {}

  // ---------------------------------------------------------------------
  // Operaciones
  // ---------------------------------------------------------------------

  /**
   * Crea un job vacio en el repositorio de Talend y lo abre en el editor.
   *
   * @param spec name, version, folder, description y replace.
   */
  public static Map<String, Object> createJob(JsonObject spec) {
    return run("create-job", () -> JobRepository.create(spec));
  }

  /**
   * Borra un job del repositorio de Talend, con sus archivos.
   *
   * @param spec name y version.
   */
  public static Map<String, Object> deleteJob(JsonObject spec) {
    return run("delete-job", () -> JobRepository.delete(spec));
  }

  /**
   * Abre un job del proyecto en el editor.
   *
   * @param spec name y version.
   */
  public static Map<String, Object> openJob(JsonObject spec) {
    return run("open-job", () -> JobRepository.open(spec));
  }

  /**
   * Anade un componente al job abierto.
   *
   * @param spec componente: type, label, position y configuracion.
   */
  public static Map<String, Object> addNode(JsonObject spec) {
    return run("add-node", () -> NodeOperations.add(spec));
  }

  /**
   * Configura un componente ya anadido al job.
   *
   * @param spec uniqueName del nodo y la configuracion.
   */
  public static Map<String, Object> configureNode(JsonObject spec) {
    return run("configure-node", () -> NodeOperations.configure(spec));
  }

  /**
   * Conecta dos nodos del job abierto.
   *
   * @param spec source, target, type y name.
   */
  public static Map<String, Object> connect(JsonObject spec) {
    return run("connect", () -> NodeOperations.connect(spec));
  }

  /**
   * Cambia los parametros o la etiqueta de un nodo.
   *
   * @param spec uniqueName, label y parameters.
   */
  public static Map<String, Object> updateNode(JsonObject spec) {
    return run("update-node", () -> NodeOperations.update(spec));
  }

  /**
   * Borra nodos del job abierto.
   *
   * @param spec uniqueNames de los nodos a borrar.
   */
  public static Map<String, Object> deleteNodes(JsonObject spec) {
    return run("delete-nodes", () -> NodeOperations.delete(spec));
  }

  /**
   * Copia un nodo del job abierto.
   *
   * @param spec uniqueName del nodo.
   */
  public static Map<String, Object> copyNode(JsonObject spec) {
    return run("copy-node", () -> NodeOperations.copy(spec));
  }

  /**
   * Lista los nodos del job abierto.
   */
  public static Map<String, Object> listNodes(JsonObject spec) {
    return run("list-nodes", () -> {
      List<Map<String, Object>> nodes = NodeOperations.list(spec);
      return (Object) nodes;
    });
  }

  /**
   * Define el schema (las columnas) de un nodo del job abierto.
   *
   * @param spec uniqueName, connector, columns y values.
   */
  public static Map<String, Object> setSchema(JsonObject spec) {
    return run("set-schema", () -> SchemaOperations.set(spec));
  }

  /**
   * Lista los componentes del catalogo de Talend.
   *
   * @param spec opcionalmente `filter` y `limit`.
   */
  public static Map<String, Object> listComponents(JsonObject spec) {
    return run("list-components", () -> ComponentCatalog.list(spec));
  }

  /**
   * Parametros de un componente del catalogo, con su tipo y su valor por
   * defecto.
   *
   * Es la forma de saber como se configura un componente sin adivinar: la
   * lista sale del propio Studio.
   *
   * @param spec name del componente.
   */
  public static Map<String, Object> componentParameters(JsonObject spec) {
    return run("component-parameters", () -> ComponentCatalog.parameters(spec));
  }

  /**
   * Ejecuta un job ya generado y devuelve su salida.
   *
   * Es la forma de comprobar que el resultado es el esperado: la salida del
   * job (las filas que imprime el tLogRow) llega aqui, cosa que con la vista
   * Run de Studio no se puede leer.
   *
   * @param spec name, version, context y timeoutMs.
   */
  public static Map<String, Object> executeJob(JsonObject spec) {
    return run("execute-job", () -> JobExecutor.execute(spec));
  }

  /**
   * Descarga un artefacto de Maven al repositorio local de Studio.
   *
   * Hay componentes cuyo runtime no viene con Studio y sin el el build falla
   * con "Missing artifact". Con esto se descargan de Maven Central.
   *
   * @param spec groupId, artifactId y version.
   */
  public static Map<String, Object> installArtifact(JsonObject spec) {
    return run("install-artifact", () -> ArtifactInstaller.install(spec));
  }

  /**
   * Mide quantos componentes del catalogo se pueden crear y configurar.
   *
   * @param spec opcionalmente `filter` y `max`.
   */
  public static Map<String, Object> coverage(JsonObject spec) {
    return run("coverage", () -> CoverageChecker.start(spec));
  }

  /**
   * Errores y avisos de diseno del job, los de la vista Problemas de Studio.
   *
   * @param spec `job` opcional.
   */
  public static Map<String, Object> problems(JsonObject spec) {
    return run("problems", () -> JobProblems.list(spec));
  }

  /**
   * Genera el codigo del job y comprueba que compila, sin ejecutarlo.
   *
   * @param spec `job` opcional.
   */
  public static Map<String, Object> compile(JsonObject spec) {
    return run("compile", () -> JobCompiler.check(spec));
  }

  /**
   * Construye el job sin ejecutarlo: genera, compila y hace el build de Maven.
   *
   * @param spec `job` opcional.
   */
  public static Map<String, Object> build(JsonObject spec) {
    return run("build", () -> JobBuilder.build(spec));
  }

  /**
   * Construye muchos jobs del repositorio sin abrir editores (ver JobBuilder.buildBatch).
   *
   * @param spec `jobs` (nombres) y `parallelism` opcional.
   */
  public static Map<String, Object> buildBatch(JsonObject spec) {
    return run("build-batch", () -> JobBuilder.buildBatch(spec));
  }

  /**
   * Memoria del JVM de Studio.
   *
   * Las mediciones largas (el codigo generado de cada job) llenan el heap: el
   * IDE se queda sin memoria y deja de responder. Con esta ruta se puede ver
   * cuanto queda y pedir una recoleccion.
   *
   * @param spec `gc: true` para forzar una recoleccion de basura.
   */
  public static Map<String, Object> memory(JsonObject spec) {
    Runtime runtime = Runtime.getRuntime();
    long max = runtime.maxMemory();
    long total = runtime.totalMemory();
    long free = runtime.freeMemory();
    long used = total - free;

    Map<String, Object> result = new LinkedHashMap<>();
    result.put("usedMb", used / (1024 * 1024));
    result.put("totalMb", total / (1024 * 1024));
    result.put("maxMb", max / (1024 * 1024));
    result.put("usedPercent", max > 0 ? (int) ((used * 100) / max) : 0);
    boolean gc = spec != null && spec.has("gc") && !spec.get("gc").isJsonNull()
        && spec.get("gc").getAsBoolean();
    if (gc) {
      System.gc();
      result.put("gc", true);
    }
    return result;
  }

  /**
   * Los contextos (entornos) del job con sus variables.
   *
   * @param spec `job` opcional.
   */
  public static Map<String, Object> contexts(JsonObject spec) {
    return run("contexts", () -> JobContexts.list(spec));
  }

  /**
   * Crea un contexto (un entorno) en el job.
   *
   * @param spec `job` y `name`.
   */
  public static Map<String, Object> createContext(JsonObject spec) {
    return run("create-context", () -> JobContexts.createContext(spec));
  }

  /**
   * Crea o cambia una variable de un contexto.
   *
   * @param spec `job`, `context`, `name`, `value` y `type` opcional.
   */
  public static Map<String, Object> setContextParameter(JsonObject spec) {
    return run("set-context-parameter", () -> JobContexts.setParameter(spec));
  }

  /**
   * Borra una variable de un contexto.
   *
   * @param spec `job`, `context` y `name`.
   */
  public static Map<String, Object> deleteContextParameter(JsonObject spec) {
    return run("delete-context-parameter", () -> JobContexts.deleteParameter(spec));
  }

  /**
   * Borra un contexto del job.
   *
   * @param spec `job` y `name`.
   */
  public static Map<String, Object> deleteContext(JsonObject spec) {
    return run("delete-context", () -> JobContexts.deleteContext(spec));
  }

  /**
   * Los contextos del proyecto (los items de tipo Contexts del repositorio).
   */
  public static Map<String, Object> repositoryContexts(JsonObject spec) {
    return run("repository-contexts", () -> RepositoryContexts.list(spec));
  }

  /** Lista conexiones compartidas del proyecto sin devolver sus parametros sensibles. */
  public static Map<String, Object> repositoryConnections(JsonObject spec) {
    return run("repository-connections", () -> RepositoryConnections.list(spec));
  }

  /** Lista schemas y columnas del repositorio sin devolver valores de configuracion. */
  public static Map<String, Object> repositorySchemas(JsonObject spec) {
    return run("repository-schemas", () -> RepositoryConnections.listSchemas(spec));
  }

  /**
   * Crea un contexto del proyecto.
   *
   * @param spec `name`, `version`, `context` y `parameters`.
   */
  public static Map<String, Object> createRepositoryContext(JsonObject spec) {
    return run("create-repository-context", () -> RepositoryContexts.create(spec));
  }

  /**
   * Crea o cambia una variable de un contexto del proyecto.
   *
   * @param spec `name`, `context`, `parameter`, `value` y `type` opcional.
   */
  public static Map<String, Object> setRepositoryContextParameter(JsonObject spec) {
    return run("set-repository-context-parameter", () -> RepositoryContexts.setParameter(spec));
  }

  /**
   * Borra una variable de un contexto del proyecto.
   *
   * @param spec `name`, `context` y `parameter`.
   */
  public static Map<String, Object> deleteRepositoryContextParameter(JsonObject spec) {
    return run("delete-repository-context-parameter", () -> RepositoryContexts.deleteParameter(spec));
  }

  /**
   * Borra un contexto del proyecto.
   *
   * @param spec `name`.
   */
  public static Map<String, Object> deleteRepositoryContext(JsonObject spec) {
    return run("delete-repository-context", () -> RepositoryContexts.delete(spec));
  }

  /**
   * Progreso de la medicion de cobertura y, al terminar, su informe.
   *
   * @param spec opcionalmente `cancel: true`.
   */
  public static Map<String, Object> coverageStatus(JsonObject spec) {
    return run("coverage-status", () -> CoverageChecker.status(spec));
  }

  /**
   * Normaliza un tipo de columna al identificador Java de Talend.
   */
  public static String normalizeColumnType(String type) {
    return ColumnTypes.normalize(type);
  }

  // ---------------------------------------------------------------------
  // Utilidades
  // ---------------------------------------------------------------------

  private interface Operation {
    Object run() throws Exception;
  }

  /** Envuelve una operacion en el sobre de respuesta del bridge. */
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

  /** Mensaje de la causa raiz de un fallo. */
  private static String describe(Exception e) {
    Throwable cause = e;
    while (cause.getCause() != null && cause.getCause() != cause) {
      cause = cause.getCause();
    }
    return cause.getMessage() != null ? cause.getMessage() : cause.toString();
  }
}
