package com.andres.talend.bridge;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import com.andres.talend.bridge.audit.CapabilityAuditService;
import com.andres.talend.bridge.audit.CommandAuditService;
import com.andres.talend.bridge.audit.PluginAuditService;
import com.andres.talend.bridge.automation.BuildJobService;
import com.andres.talend.bridge.automation.CodeRunnerService;
import com.andres.talend.bridge.automation.JobOperationsService;
import com.andres.talend.bridge.diagnostics.LogTailService;
import com.andres.talend.bridge.events.EventsService;
import com.andres.talend.bridge.launch.LaunchConfigService;
import com.andres.talend.bridge.launch.LaunchTrackerService;
import com.andres.talend.bridge.problems.ProblemMarkerService;
import com.andres.talend.bridge.resources.WorkspaceService;
import com.andres.talend.bridge.talend.TalendClassProbeService;
import com.andres.talend.bridge.talend.TalendIntrospectionService;
import com.andres.talend.bridge.workbench.DialogListService;
import com.andres.talend.bridge.workbench.ModalGuard;
import com.andres.talend.bridge.workbench.WorkbenchService;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParseException;
import com.google.gson.JsonParser;
import com.google.gson.JsonPrimitive;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

import org.osgi.framework.Bundle;
import org.osgi.framework.BundleContext;
import org.osgi.framework.FrameworkUtil;

/**
 * Servidor HTTP del bridge: escucha solo en 127.0.0.1 y exige el token en cada
 * peticion, salvo {@code /ping}.
 *
 * Todas las rutas se declaran en {@link #registerRoutes()}. Al anadir una, la
 * decision que hay que tomar es el hilo en el que corre:
 *
 * <ul>
 *   <li>Hilo de trabajo ({@code worker}, {@code workerBody}): no toca widgets ni el
 *       modelo del job. Lectura del workspace, procesos, descargas, ejecuciones.</li>
 *   <li>Hilo de la UI ({@code ui}, {@code uiBody}): toca widgets o el modelo del job,
 *       asi que se ejecuta con {@link UiThread#sync}. Debe ser corto.</li>
 * </ul>
 */
final class BridgeServer {
  /** Tamanio maximo admitido para el cuerpo de una peticion. */
  private static final int MAX_BODY_BYTES = 1_048_576;

  /** Maximo de peticiones concurrentes atendidas por el bridge. */
  private static final int MAX_WORKER_THREADS = 16;

  /** Por encima de este tiempo, una peticion queda registrada en el Error Log. */
  private static final long SLOW_REQUEST_MS = 5_000L;

  /** Rutas que tardan a proposito (esperas, compilaciones, ejecuciones): no se registran como lentas. */
  private static final Set<String> LONG_RUNNING_ROUTES = Set.of(
      "/automation/artifacts/install",
      "/automation/coverage",
      "/automation/job/build",
      "/automation/job/build-batch",
      "/automation/job/compile",
      "/automation/job/execute",
      "/automation/run-active-job",
      "/launch/wait");

  private static final long STARTED_AT = System.currentTimeMillis();

  /** Accion sin cuerpo que devuelve el payload de la respuesta. */
  @FunctionalInterface
  private interface Action {
    Map<String, Object> run() throws Exception;
  }

  /** Accion que recibe el cuerpo JSON de la peticion y devuelve el payload. */
  @FunctionalInterface
  private interface BodyAction {
    Map<String, Object> run(JsonObject body) throws Exception;
  }

  /** Ruta que escribe la respuesta por si misma (query string o validaciones propias). */
  @FunctionalInterface
  private interface Handler {
    void handle(HttpExchange exchange) throws Exception;
  }

  @FunctionalInterface
  private interface ThrowingAction {
    void run() throws Exception;
  }

  /** El cuerpo de la peticion supera el limite permitido. */
  private static final class PayloadTooLargeException extends RuntimeException {
    private static final long serialVersionUID = 1L;

    PayloadTooLargeException() {
      super("El cuerpo de la peticion excede " + MAX_BODY_BYTES + " bytes");
    }
  }

  /** La peticion es invalida (JSON mal formado o parametro obligatorio ausente). */
  private static final class BadRequestException extends RuntimeException {
    private static final long serialVersionUID = 1L;

    private final String code;

    BadRequestException(String code, String message) {
      super(message);
      this.code = code;
    }
  }

  /** Configuracion leida, con la huella del archivo con el que se leyo. */
  private record ConfigSnapshot(BridgeConfig config, String signature) {}

  private final BundleContext bundleContext;
  private final String token;
  private volatile ConfigSnapshot configSnapshot;
  private HttpServer server;
  private ExecutorService executor;

  BridgeServer(BundleContext bundleContext) {
    this.bundleContext = bundleContext;
    this.configSnapshot = loadSnapshot();
    this.token = BridgeConfig.ensureToken();
  }

  /**
   * Configuracion vigente. Se relee solo cuando cambia el archivo (fecha y
   * tamanio) en lugar de parsear el JSON en cada peticion. Asi ajustar permisos,
   * por ejemplo habilitar ejecuciones, sigue sin reiniciar Talend Studio.
   */
  private BridgeConfig config() {
    ConfigSnapshot current = configSnapshot;
    if (!BridgeConfig.signature().equals(current.signature())) {
      current = loadSnapshot();
      configSnapshot = current;
    }
    return current.config();
  }

  private static ConfigSnapshot loadSnapshot() {
    String signature = BridgeConfig.signature();
    return new ConfigSnapshot(BridgeConfig.load(), signature);
  }

  void start() {
    // Al recargar el bundle en caliente, el socket del servidor viejo puede tardar
    // un instante en liberarse. Si no se reintenta, el bundle nuevo no arranca y
    // el bridge se queda caido.
    IOException lastError = null;
    for (int intento = 1; intento <= 6; intento++) {
      try {
        startServer();
        return;
      } catch (IOException e) {
        lastError = e;
        BridgeLog.warn("El puerto " + config().port + " esta ocupado (intento " + intento + "), reintentando");
        try {
          Thread.sleep(500L * intento);
        } catch (InterruptedException interrupted) {
          Thread.currentThread().interrupt();
          break;
        }
      }
    }
    BridgeLog.error("No se pudo iniciar el bridge HTTP en el puerto " + config().port, lastError);
    throw new IllegalStateException("No se pudo iniciar el bridge HTTP", lastError);
  }

  private void startServer() throws IOException {
    server = HttpServer.create(new InetSocketAddress("127.0.0.1", config().port), 0);
    registerRoutes();

    executor = Executors.newFixedThreadPool(MAX_WORKER_THREADS, runnable -> {
      Thread thread = new Thread(runnable, "talend-bridge");
      thread.setDaemon(true);
      return thread;
    });
    server.setExecutor(executor);
    server.start();

    BridgeLog.info("Bridge escuchando en http://127.0.0.1:" + config().port
        + " (token en " + BridgeConfig.tokenPath() + ")");
  }

  void stop() {
    if (server != null) {
      server.stop(0);
      server = null;
    }
    if (executor != null) {
      executor.shutdownNow();
      try {
        executor.awaitTermination(2, TimeUnit.SECONDS);
      } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
      }
      executor = null;
    }
  }

  int boundPort() {
    return server == null ? config().port : server.getAddress().getPort();
  }

  /** Tabla de rutas del bridge. Cada ruta aparece una sola vez. */
  private void registerRoutes() {
    // Latido: sin token. Es lo unico que se ve sin autenticarse.
    route("/ping", exchange -> respond(exchange, 200, pingPayload()));
    worker("/capabilities", () -> CapabilityAuditService.capabilities(config()));
    worker("/audit/environment", () -> PluginAuditService.auditEnvironment(bundleContext));
    route("/logs/tail", this::handleLogTail);

    // Workbench: editores, vistas y dialogos.
    ui("/workbench/state", () -> WorkbenchService.state());
    ui("/workbench/selection", () -> WorkbenchService.selection());
    ui("/workbench/views", () -> WorkbenchService.views());
    ui("/workbench/save-active", () -> WorkbenchService.saveActiveEditor());
    ui("/workbench/save-all", () -> WorkbenchService.saveAllEditors());
    ui("/workbench/dialogs", () -> ModalGuard.dismissBlockingDialogs());
    ui("/workbench/modules/install", () -> ModalGuard.installMissingModules());
    ui("/workbench/dialogs/list", () -> DialogListService.list());
    route("/workbench/open-resource", this::handleOpenResource);
    route("/workbench/close-editor", this::handleCloseEditor);
    route("/workbench/activate-editor", this::handleActivateEditor);
    route("/workbench/find-editor", this::handleFindEditor);
    route("/workbench/show-view", this::handleShowView);
    route("/workbench/hide-view", this::handleHideView);

    // Workspace y problemas. Solo leen disco; el refresh toca la vista del workspace.
    worker("/workspace/state", () -> WorkspaceService.state());
    ui("/workspace/refresh", () -> WorkspaceService.refresh());
    worker("/problems/markers", () -> ProblemMarkerService.markers());
    worker("/talend/probe/classes", () -> TalendClassProbeService.probe());
    workerBody("/talend/api/check", body -> TalendClassProbeService.check(body));

    // Comandos de Studio, ejecuciones (launch configs) y eventos.
    ui("/commands/list", () -> CommandAuditService.listCommands());
    route("/commands/execute", this::handleExecuteCommand);
    worker("/launch/configs", () -> LaunchConfigService.listConfigs());
    route("/launch/run", this::handleLaunchRun);
    worker("/launch/runs", () -> LaunchTrackerService.runs());
    route("/launch/run-status", this::handleLaunchRunStatus);
    route("/launch/wait", this::handleLaunchWait);
    worker("/events/recent", () -> EventsService.recent());
    worker("/events/clear", () -> EventsService.clear());

    // Introspeccion del editor y del job activo.
    ui("/talend/active-editor/introspect", () -> TalendIntrospectionService.activeEditorIntrospect());
    ui("/talend/active-job/model", () -> TalendIntrospectionService.activeJobModel());
    ui("/talend/active-job/details", () -> TalendIntrospectionService.activeJobDetails());
    ui("/talend/active-job/dependencies", () -> TalendIntrospectionService.activeJobDependencies());
    route("/talend/active-component/details", this::handleActiveComponentDetails);
    route("/talend/active-job/select-component", this::handleSelectComponent);

    // Automatizacion fuera de la UI: descargas, ejecuciones, build y cobertura.
    // La cobertura recorre el catalogo entero y cede a la UI componente a componente
    // (ver CoverageChecker), asi que no puede correr entera dentro de ella.
    workerBody("/automation/artifacts/install", body -> JobOperationsService.installArtifact(body));
    workerBody("/automation/build-job", body -> {
      requireWritable(config());
      return BuildJobService.build(body);
    });
    workerBody("/automation/coverage", body -> JobOperationsService.coverage(body));
    workerBody("/automation/coverage/status", body -> JobOperationsService.coverageStatus(body));
    workerBody("/automation/memory", body -> JobOperationsService.memory(body));
    workerBody("/automation/job/execute", body -> JobOperationsService.executeJob(body));
    route("/automation/run-active-job", this::handleAutomationRunActiveJob);
    route("/automation/run-code", this::handleRunCode);

    // Operaciones sobre el job abierto. Usan la API del IDE (cada nodo nace con sus
    // parametros y el XML lo escribe Studio), asi que van en el hilo de la UI.
    uiBody("/automation/components", body -> JobOperationsService.listComponents(body));
    uiBody("/automation/components/parameters", body -> JobOperationsService.componentParameters(body));
    uiBody("/automation/job/create", body -> JobOperationsService.createJob(body));
    uiBody("/automation/job/delete", body -> JobOperationsService.deleteJob(body));
    uiBody("/automation/job/open", body -> JobOperationsService.openJob(body));
    // Generar el codigo valida la sintaxis en la UI y tarda varios segundos.
    uiBody("/automation/job/compile", 180_000L, body -> JobOperationsService.compile(body));
    // Construye el job (genera y compila en la UI; el build de Maven va en el hilo de la peticion).
    route("/automation/job/build", exchange -> respond(exchange, 200, JobOperationsService.build(readJsonBody(exchange))));
    route("/automation/job/build-batch", exchange -> respond(exchange, 200, JobOperationsService.buildBatch(readJsonBody(exchange))));
    uiBody("/automation/job/problems", body -> JobOperationsService.problems(body));
    uiBody("/automation/job/contexts", body -> JobOperationsService.contexts(body));
    uiBody("/automation/job/contexts/parameters", body -> JobOperationsService.addContextParameters(body));
    uiBody("/automation/job/contexts/create", body -> JobOperationsService.createContext(body));
    uiBody("/automation/job/contexts/parameter", body -> JobOperationsService.setContextParameter(body));
    uiBody("/automation/job/contexts/parameter/delete", body -> JobOperationsService.deleteContextParameter(body));
    uiBody("/automation/job/contexts/delete", body -> JobOperationsService.deleteContext(body));
    uiBody("/automation/nodes/list", body -> JobOperationsService.listNodes(body));
    uiBody("/automation/nodes/add", body -> JobOperationsService.addNode(body));
    uiBody("/automation/nodes/connect", body -> JobOperationsService.connect(body));
    uiBody("/automation/nodes/disconnect", body -> JobOperationsService.disconnect(body));
    uiBody("/automation/nodes/update", body -> JobOperationsService.updateNode(body));
    uiBody("/automation/nodes/delete", body -> JobOperationsService.deleteNodes(body));
    uiBody("/automation/nodes/copy", body -> JobOperationsService.copyNode(body));
    uiBody("/automation/nodes/schema", body -> JobOperationsService.setSchema(body));
    uiBody("/automation/nodes/configure", body -> JobOperationsService.configureNode(body));

    // Contextos y conexiones del repositorio del proyecto.
    uiBody("/automation/repository/contexts", body -> JobOperationsService.repositoryContexts(body));
    uiBody("/automation/repository/connections", body -> JobOperationsService.repositoryConnections(body));
    uiBody("/automation/repository/schemas", body -> JobOperationsService.repositorySchemas(body));
    uiBody("/automation/repository/contexts/create", body -> JobOperationsService.createRepositoryContext(body));
    uiBody("/automation/repository/contexts/parameter", body -> JobOperationsService.setRepositoryContextParameter(body));
    uiBody("/automation/repository/contexts/parameter/delete", body -> JobOperationsService.deleteRepositoryContextParameter(body));
    uiBody("/automation/repository/contexts/delete", body -> JobOperationsService.deleteRepositoryContext(body));
  }

  /** Ruta sin cuerpo que responde con el resultado de la accion, en el hilo de trabajo. */
  private void worker(String path, Action action) {
    route(path, exchange -> respond(exchange, 200, action.run()));
  }

  /** Ruta que lee el cuerpo JSON y responde con el resultado, en el hilo de trabajo. */
  private void workerBody(String path, BodyAction action) {
    route(path, exchange -> respond(exchange, 200, action.run(readJsonBody(exchange))));
  }

  /** Ruta sin cuerpo que ejecuta la accion en el hilo de la UI de Studio. */
  private void ui(String path, Action action) {
    route(path, exchange -> respond(exchange, 200, UiThread.sync(action::run)));
  }

  /** Ruta que lee el cuerpo JSON y ejecuta la accion en el hilo de la UI de Studio. */
  private void uiBody(String path, BodyAction action) {
    uiBody(path, UiThread.DEFAULT_TIMEOUT_MS, action);
  }

  private void uiBody(String path, long timeoutMs, BodyAction action) {
    route(path, exchange -> {
      // El cuerpo se lee fuera de la UI: leer la peticion no necesita widgets.
      JsonObject body = readJsonBody(exchange);
      respond(exchange, 200, UiThread.sync(() -> action.run(body), timeoutMs));
    });
  }

  /** Registra una ruta con autenticacion, validacion de metodo y manejo de errores. */
  private void route(String path, Handler handler) {
    server.createContext(path, exchange -> guarded(exchange, () -> handler.handle(exchange)));
  }

  private Map<String, Object> pingPayload() {
    BridgeConfig current = config();
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("ok", true);
    payload.put("source", "studio-bridge");
    payload.put("confidence", "high");
    payload.put("endpoint", "/ping");
    payload.put("plugin", Activator.PLUGIN_ID);
    payload.put("version", pluginVersion());
    payload.put("mode", current.readOnly ? "readOnly" : "readWrite");
    payload.put("unsafeActions", current.unsafeActions);
    payload.put("hotReload", true);
    payload.put("pid", ProcessHandle.current().pid());
    payload.put("javaVersion", System.getProperty("java.version"));
    payload.put("startedAt", STARTED_AT);
    payload.put("uptimeMs", System.currentTimeMillis() - STARTED_AT);
    return payload;
  }

  private String pluginVersion() {
    Bundle bundle = FrameworkUtil.getBundle(BridgeServer.class);
    return bundle == null ? "unknown" : bundle.getVersion().toString();
  }

  /**
   * Aplica autenticacion, validacion de metodo, medicion de tiempos y manejo de
   * errores a todas las rutas, para que ninguna respuesta quede sin cuerpo o sin
   * contexto.
   */
  private void guarded(HttpExchange exchange, ThrowingAction action) throws IOException {
    String path = exchange.getHttpContext().getPath();

    if (!"/ping".equals(path)) {
      if (!authorized(exchange)) {
        respond(exchange, 401, errorPayload(path, "AUTH_REQUIRED", "Falta Authorization: Bearer <token>"));
        return;
      }
      String method = exchange.getRequestMethod();
      if (!"GET".equals(method) && !"POST".equals(method)) {
        exchange.getResponseHeaders().set("Allow", "GET, POST");
        respond(exchange, 405, errorPayload(path, "METHOD_NOT_ALLOWED", "Metodo no permitido: " + method));
        return;
      }
    }

    long started = System.nanoTime();
    try {
      action.run();
    } catch (PayloadTooLargeException e) {
      respond(exchange, 413, errorPayload(path, "PAYLOAD_TOO_LARGE", e.getMessage()));
    } catch (BadRequestException e) {
      respond(exchange, 400, errorPayload(path, e.code, e.getMessage()));
    } catch (IOException e) {
      // Casi siempre es el cliente que corto la conexion: ya no hay a quien responder.
      BridgeLog.warn("Conexion interrumpida atendiendo " + path, e);
    } catch (Exception e) {
      BridgeLog.error("Fallo atendiendo " + path, e);
      // toString() conserva el nombre de la excepcion (java.lang.NullPointerException: ...),
      // que es lo que usa el diagnostico para reconocer el fallo.
      respond(exchange, 500, errorPayload(path, "INTERNAL_ERROR", e.toString()));
    } finally {
      logIfSlow(path, started);
    }
  }

  private void logIfSlow(String path, long startedNanos) {
    long elapsedMs = (System.nanoTime() - startedNanos) / 1_000_000L;
    if (elapsedMs > SLOW_REQUEST_MS && !LONG_RUNNING_ROUTES.contains(path)) {
      BridgeLog.warn("Peticion lenta a " + path + ": " + elapsedMs + " ms");
    }
  }

  private boolean authorized(HttpExchange exchange) {
    String header = exchange.getRequestHeaders().getFirst("Authorization");
    if (header == null || !header.startsWith("Bearer ")) {
      return false;
    }
    byte[] expected = token.getBytes(StandardCharsets.UTF_8);
    byte[] provided = header.substring("Bearer ".length()).trim().getBytes(StandardCharsets.UTF_8);
    return MessageDigest.isEqual(expected, provided);
  }

  private void handleOpenResource(HttpExchange exchange) throws IOException {
    JsonObject body = readJsonBody(exchange);
    String path = requiredParam(exchange, body, "path");
    respond(exchange, 200, UiThread.sync(() -> WorkbenchService.openResource(path)));
  }

  private void handleCloseEditor(HttpExchange exchange) throws IOException {
    JsonObject body = readJsonBody(exchange);
    String title = requiredParam(exchange, body, "title");
    boolean save = optBoolean(body, "save", true);
    respond(exchange, 200, UiThread.sync(() -> WorkbenchService.closeEditor(title, save)));
  }

  private void handleActivateEditor(HttpExchange exchange) throws IOException {
    JsonObject body = readJsonBody(exchange);
    String title = requiredParam(exchange, body, "title");
    respond(exchange, 200, UiThread.sync(() -> WorkbenchService.activateEditor(title)));
  }

  private void handleFindEditor(HttpExchange exchange) throws IOException {
    JsonObject body = readJsonBody(exchange);
    String titleContains = requiredParam(exchange, body, "titleContains");
    respond(exchange, 200, UiThread.sync(() -> WorkbenchService.findEditor(titleContains)));
  }

  private void handleHideView(HttpExchange exchange) throws IOException {
    JsonObject body = readJsonBody(exchange);
    String viewId = requiredParam(exchange, body, "viewId");
    respond(exchange, 200, UiThread.sync(() -> WorkbenchService.hideView(viewId)));
  }

  private void handleShowView(HttpExchange exchange) throws IOException {
    JsonObject body = readJsonBody(exchange);
    String viewId = requiredParam(exchange, body, "viewId");
    respond(exchange, 200, UiThread.sync(() -> WorkbenchService.showView(viewId)));
  }

  private void handleActiveComponentDetails(HttpExchange exchange) throws IOException {
    JsonObject body = readJsonBody(exchange);
    String uniqueName = requiredParam(exchange, body, "uniqueName");
    boolean includeRaw = optBoolean(body, "includeRaw", false);
    respond(exchange, 200, UiThread.sync(
        () -> TalendIntrospectionService.activeComponentDetails(uniqueName, includeRaw)));
  }

  private void handleSelectComponent(HttpExchange exchange) throws IOException {
    JsonObject body = readJsonBody(exchange);
    String uniqueName = requiredParam(exchange, body, "uniqueName");
    respond(exchange, 200, UiThread.sync(() -> TalendIntrospectionService.selectComponent(uniqueName)));
  }

  private void handleExecuteCommand(HttpExchange exchange) throws IOException {
    JsonObject body = readJsonBody(exchange);
    String commandId = requiredParam(exchange, body, "commandId");
    boolean dryRun = optBoolean(body, "dryRun", true);
    respond(exchange, 200, UiThread.sync(() -> CommandAuditService.executeCommand(commandId, dryRun, config())));
  }

  private void handleLaunchRun(HttpExchange exchange) throws IOException {
    JsonObject body = readJsonBody(exchange);
    String name = requiredParam(exchange, body, "name");
    String mode = optString(body, "mode");
    boolean dryRun = optBoolean(body, "dryRun", true);
    respond(exchange, 200, LaunchConfigService.runLaunchConfig(name, mode, dryRun, config()));
  }

  private void handleLaunchRunStatus(HttpExchange exchange) throws IOException {
    JsonObject body = readJsonBody(exchange);
    String launchId = requiredParam(exchange, body, "launchId");
    respond(exchange, 200, LaunchTrackerService.runStatus(launchId));
  }

  private void handleLaunchWait(HttpExchange exchange) throws IOException {
    JsonObject body = readJsonBody(exchange);
    String launchId = requiredParam(exchange, body, "launchId");
    int timeoutMs = optInt(body, "timeoutMs", 60000);
    LaunchTrackerService.LaunchRunInfo info = LaunchTrackerService.waitForLaunch(launchId, timeoutMs);
    if (info != null && info.terminatedAt != null) {
      respond(exchange, 200, LaunchTrackerService.runStatus(launchId));
      return;
    }
    // Al expirar se devuelve el estado actual: el cliente debe ver que el job sigue
    // en marcha (o no se puede confirmar) y no solo que hubo timeout.
    Map<String, Object> payload = new LinkedHashMap<>(LaunchTrackerService.runStatus(launchId));
    payload.put("endpoint", "/launch/wait");
    payload.put("timedOut", true);
    respond(exchange, 200, payload);
  }

  /**
   * Ejecuta el job abierto. La ejecucion NO va dentro de UiThread.sync: lanzar el
   * job y esperar su terminacion tarda decenas de segundos y congelaria Studio.
   */
  private void handleAutomationRunActiveJob(HttpExchange exchange) throws IOException {
    JsonObject body = readJsonBody(exchange);
    boolean dryRun = optBoolean(body, "dryRun", true);
    boolean saveBefore = optBoolean(body, "saveBefore", true);
    boolean waitForTermination = optBoolean(body, "waitForTermination", true);
    int timeoutMs = optInt(body, "timeoutMs", 120000);
    respond(exchange, 200, AutomationService.runActiveJob(saveBefore, waitForTermination, timeoutMs, dryRun, config()));
  }

  /**
   * Ejecuta codigo Java dentro de Studio. El codigo ve las mismas APIs que ve el
   * IDE, asi que solo corre con las acciones inseguras habilitadas: puede tocar el
   * workspace de forma irreversible.
   */
  private void handleRunCode(HttpExchange exchange) throws IOException {
    JsonObject body = readJsonBody(exchange);
    BridgeConfig current = config();
    requireWritable(current);
    if (!current.unsafeActions) {
      throw new BadRequestException("UNSAFE_ACTIONS_DISABLED",
          "La ejecucion de codigo requiere unsafeActions=true");
    }
    respond(exchange, 200, CodeRunnerService.run(body));
  }

  /** Ultimas lineas del Error Log de Studio: GET /logs/tail?lines=200. */
  private void handleLogTail(HttpExchange exchange) throws IOException {
    int lines = queryInt(exchange, "lines", LogTailService.DEFAULT_LINES);
    respond(exchange, 200, LogTailService.tail(lines));
  }

  private static void requireWritable(BridgeConfig config) {
    if (config.readOnly) {
      throw new BadRequestException("READ_ONLY", "El bridge esta en modo readOnly");
    }
  }

  /** Parametro obligatorio: del cuerpo JSON o, si no viene, de la query string. */
  private String requiredParam(HttpExchange exchange, JsonObject body, String key) {
    String value = optString(body, key);
    if (isBlank(value)) {
      value = queryParam(exchange, key);
    }
    if (isBlank(value)) {
      throw new BadRequestException("MISSING_PARAMETER", "Falta el parametro '" + key + "'");
    }
    return value;
  }

  private static boolean isBlank(String value) {
    return value == null || value.trim().isEmpty();
  }

  private int queryInt(HttpExchange exchange, String key, int fallback) {
    String value = queryParam(exchange, key);
    if (isBlank(value)) {
      return fallback;
    }
    try {
      return Integer.parseInt(value.trim());
    } catch (NumberFormatException e) {
      return fallback;
    }
  }

  private String queryParam(HttpExchange exchange, String key) {
    String query = exchange.getRequestURI().getRawQuery();
    if (query == null || query.isEmpty()) return null;

    for (String part : query.split("&")) {
      String[] kv = part.split("=", 2);
      if (kv.length == 2 && kv[0].equals(key)) {
        try {
          return java.net.URLDecoder.decode(kv[1], StandardCharsets.UTF_8.name());
        } catch (java.io.UnsupportedEncodingException e) {
          return kv[1];
        }
      }
    }

    return null;
  }

  /**
   * Lee el cuerpo de la peticion como objeto JSON.
   *
   * @throws BadRequestException si el cuerpo no es un objeto JSON valido.
   * @throws PayloadTooLargeException si el cuerpo excede el limite admitido.
   */
  private JsonObject readJsonBody(HttpExchange exchange) throws IOException {
    String body = readBody(exchange);
    if (body.isEmpty()) {
      return new JsonObject();
    }

    try {
      JsonElement parsed = JsonParser.parseString(body);
      if (!parsed.isJsonObject()) {
        throw new BadRequestException("INVALID_BODY", "El cuerpo de la peticion debe ser un objeto JSON");
      }
      return parsed.getAsJsonObject();
    } catch (JsonParseException e) {
      throw new BadRequestException("INVALID_JSON", "JSON invalido: " + e.getMessage());
    }
  }

  private String readBody(HttpExchange exchange) throws IOException {
    try (InputStream inputStream = exchange.getRequestBody()) {
      ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
      byte[] buffer = new byte[8192];
      int read;
      int total = 0;
      while ((read = inputStream.read(buffer)) != -1) {
        total += read;
        if (total > MAX_BODY_BYTES) {
          throw new PayloadTooLargeException();
        }
        outputStream.write(buffer, 0, read);
      }
      return new String(outputStream.toByteArray(), StandardCharsets.UTF_8).trim();
    }
  }

  private static String optString(JsonObject body, String key) {
    JsonElement element = body.get(key);
    if (element == null || element.isJsonNull() || !element.isJsonPrimitive()) {
      return null;
    }
    return element.getAsString();
  }

  private static boolean optBoolean(JsonObject body, String key, boolean fallback) {
    JsonElement element = body.get(key);
    if (element == null || element.isJsonNull() || !element.isJsonPrimitive()) {
      return fallback;
    }
    JsonPrimitive primitive = element.getAsJsonPrimitive();
    if (primitive.isBoolean()) {
      return primitive.getAsBoolean();
    }
    if (primitive.isString()) {
      return Boolean.parseBoolean(primitive.getAsString());
    }
    return fallback;
  }

  private static int optInt(JsonObject body, String key, int fallback) {
    JsonElement element = body.get(key);
    if (element == null || element.isJsonNull() || !element.isJsonPrimitive()) {
      return fallback;
    }
    try {
      return element.getAsInt();
    } catch (RuntimeException e) {
      return fallback;
    }
  }

  private void respond(HttpExchange exchange, int status, Map<String, Object> payload) throws IOException {
    byte[] bytes = JsonUtil.stringify(payload).getBytes(StandardCharsets.UTF_8);
    exchange.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
    exchange.sendResponseHeaders(status, bytes.length);
    try (OutputStream outputStream = exchange.getResponseBody()) {
      outputStream.write(bytes);
    }
  }

  private Map<String, Object> errorPayload(String endpoint, String code, String message) {
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("ok", false);
    payload.put("source", "studio-bridge");
    payload.put("confidence", "low");
    payload.put("endpoint", endpoint);
    Map<String, Object> error = new LinkedHashMap<>();
    error.put("code", code);
    error.put("message", message);
    payload.put("error", error);
    return payload;
  }
}
