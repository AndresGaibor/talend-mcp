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
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import com.andres.talend.bridge.audit.CapabilityAuditService;
import com.andres.talend.bridge.audit.CommandAuditService;
import com.andres.talend.bridge.audit.PluginAuditService;
import com.andres.talend.bridge.automation.CodeRunnerService;
import com.andres.talend.bridge.automation.JobOperationsService;
import com.andres.talend.bridge.events.EventsService;
import com.andres.talend.bridge.launch.LaunchConfigService;
import com.andres.talend.bridge.launch.LaunchTrackerService;
import com.andres.talend.bridge.problems.ProblemMarkerService;
import com.andres.talend.bridge.resources.WorkspaceService;
import com.andres.talend.bridge.talend.TalendClassProbeService;
import com.andres.talend.bridge.talend.TalendIntrospectionService;
import com.andres.talend.bridge.workbench.ModalGuard;
import com.andres.talend.bridge.workbench.WorkbenchService;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.google.gson.JsonPrimitive;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

import org.osgi.framework.Bundle;
import org.osgi.framework.BundleContext;
import org.osgi.framework.FrameworkUtil;

final class BridgeServer {
  /** Tamanio maximo admitido para el cuerpo de una peticion. */
  private static final int MAX_BODY_BYTES = 1_048_576;

  /** Maximo de peticiones concurrentes atendidas por el bridge. */
  private static final int MAX_WORKER_THREADS = 16;

  private interface ThrowingAction {
    void run() throws IOException;
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

  private final BundleContext bundleContext;
  private final String token;
  private volatile BridgeConfig config;
  private HttpServer server;
  private ExecutorService executor;

  BridgeServer(BundleContext bundleContext) {
    this.bundleContext = bundleContext;
    this.config = BridgeConfig.load();
    this.token = BridgeConfig.ensureToken();
  }

  /**
   * Configuracion vigente.
   *
   * Se relee cuando cambia el archivo para que ajustar permisos (por ejemplo
   * habilitar ejecuciones) no exija reiniciar Talend Studio.
   */
  private BridgeConfig config() {
    BridgeConfig current = this.config;
    BridgeConfig reloaded = BridgeConfig.load();
    if (reloaded != null) {
      this.config = reloaded;
    }
    return this.config;
  }

  void start() {
    // Al recargar el bundle en caliente, el socket del servidor viejo puede
    // tardar un instante en liberarse. Si no se reintenta, el bundle nuevo no
    // arranca y el bridge se queda caido.
    IOException lastError = null;
    for (int intento = 1; intento <= 6; intento++) {
      try {
        startServer();
        return;
      } catch (IOException e) {
        lastError = e;
        BridgeLog.warn("El puerto " + config.port + " esta ocupado (intento " + intento + "), reintentando");
        try {
          Thread.sleep(500L * intento);
        } catch (InterruptedException interrupted) {
          Thread.currentThread().interrupt();
          break;
        }
      }
    }
    BridgeLog.error("No se pudo iniciar el bridge HTTP en el puerto " + config.port, lastError);
    throw new IllegalStateException("No se pudo iniciar el bridge HTTP", lastError);
  }

  private void startServer() throws IOException {
    try {
      server = HttpServer.create(new InetSocketAddress("127.0.0.1", config.port), 0);
      server.createContext("/ping", exchange -> guarded(exchange, () -> respond(exchange, 200, pingPayload())));
      server.createContext("/capabilities", exchange -> guarded(exchange, () -> respond(exchange, 200, CapabilityAuditService.capabilities(config()))));
      server.createContext("/audit/environment", exchange -> guarded(exchange, () -> respond(exchange, 200, PluginAuditService.auditEnvironment(bundleContext))));
      server.createContext("/workbench/state", exchange -> guarded(exchange, () -> respond(exchange, 200, UiThread.sync(WorkbenchService::state))));
      server.createContext("/workbench/selection", exchange -> guarded(exchange, () -> respond(exchange, 200, UiThread.sync(WorkbenchService::selection))));
      server.createContext("/workbench/views", exchange -> guarded(exchange, () -> respond(exchange, 200, UiThread.sync(WorkbenchService::views))));
      server.createContext("/workbench/open-resource", exchange -> guarded(exchange, () -> handleOpenResource(exchange)));
      server.createContext("/workbench/save-active", exchange -> guarded(exchange, () -> respond(exchange, 200, UiThread.sync(WorkbenchService::saveActiveEditor))));
      server.createContext("/workbench/save-all", exchange -> guarded(exchange, () -> respond(exchange, 200, UiThread.sync(WorkbenchService::saveAllEditors))));
      server.createContext("/workbench/close-editor", exchange -> guarded(exchange, () -> handleCloseEditor(exchange)));
      server.createContext("/workbench/activate-editor", exchange -> guarded(exchange, () -> handleActivateEditor(exchange)));
      server.createContext("/workbench/find-editor", exchange -> guarded(exchange, () -> handleFindEditor(exchange)));
      server.createContext("/workbench/show-view", exchange -> guarded(exchange, () -> handleShowView(exchange)));
      server.createContext("/workbench/dialogs", exchange -> guarded(exchange, () -> respond(exchange, 200, UiThread.sync(ModalGuard::dismissBlockingDialogs))));
      server.createContext("/workbench/modules/install", exchange -> guarded(exchange, () -> respond(exchange, 200, UiThread.sync(ModalGuard::installMissingModules))));
      // Descarga de la red: no toca ningun widget, asi que no entra en la UI.
      server.createContext("/automation/artifacts/install", exchange -> guarded(exchange, () -> respond(exchange, 200, JobOperationsService.installArtifact(readJsonBody(exchange)))));
      // La cobertura recorre el catalogo entero. El bucle corre en este hilo de
      // trabajo y solo cede a la UI componente a componente (ver CoverageChecker):
      // si todo fuera en la UI, Studio quedaria congelado durante minutos.
      server.createContext("/automation/coverage", exchange -> guarded(exchange, () -> respond(exchange, 200, JobOperationsService.coverage(readJsonBody(exchange)))));
      server.createContext("/automation/coverage/status", exchange -> guarded(exchange, () -> respond(exchange, 200, JobOperationsService.coverageStatus(readJsonBody(exchange)))));
      server.createContext("/workspace/state", exchange -> guarded(exchange, () -> respond(exchange, 200, WorkspaceService.state())));
      server.createContext("/workspace/refresh", exchange -> guarded(exchange, () -> respond(exchange, 200, UiThread.sync(WorkspaceService::refresh))));
      server.createContext("/problems/markers", exchange -> guarded(exchange, () -> respond(exchange, 200, ProblemMarkerService.markers())));
      server.createContext("/talend/probe/classes", exchange -> guarded(exchange, () -> respond(exchange, 200, TalendClassProbeService.probe(bundleContext))));
      server.createContext("/talend/active-editor/introspect", exchange -> guarded(exchange, () -> respond(exchange, 200, UiThread.sync(TalendIntrospectionService::activeEditorIntrospect))));
      server.createContext("/talend/active-job/model", exchange -> guarded(exchange, () -> respond(exchange, 200, UiThread.sync(TalendIntrospectionService::activeJobModel))));
      server.createContext("/talend/active-job/details", exchange -> guarded(exchange, () -> respond(exchange, 200, UiThread.sync(TalendIntrospectionService::activeJobDetails))));
      server.createContext("/talend/active-component/details", exchange -> guarded(exchange, () -> handleActiveComponentDetails(exchange)));
      server.createContext("/talend/active-job/select-component", exchange -> guarded(exchange, () -> handleSelectComponent(exchange)));
      server.createContext("/commands/list", exchange -> guarded(exchange, () -> respond(exchange, 200, UiThread.sync(CommandAuditService::listCommands))));
      server.createContext("/commands/execute", exchange -> guarded(exchange, () -> handleExecuteCommand(exchange)));
      server.createContext("/launch/configs", exchange -> guarded(exchange, () -> respond(exchange, 200, LaunchConfigService.listConfigs())));
      server.createContext("/launch/run", exchange -> guarded(exchange, () -> handleLaunchRun(exchange)));
      server.createContext("/events/recent", exchange -> guarded(exchange, () -> respond(exchange, 200, EventsService.recent())));
      server.createContext("/events/clear", exchange -> guarded(exchange, () -> respond(exchange, 200, EventsService.clear())));
      server.createContext("/automation/run-active-job", exchange -> guarded(exchange, () -> handleAutomationRunActiveJob(exchange)));
      server.createContext("/automation/job/create", exchange -> guarded(exchange, () -> handleNodeOperation(exchange, "createJob")));
      server.createContext("/automation/job/delete", exchange -> guarded(exchange, () -> handleNodeOperation(exchange, "deleteJob")));
      // Estas tres no tocan widgets ni el modelo: van en el hilo de trabajo
      // HTTP, que si no congela Studio. Ver docs/TALEND-STUDIO-INTERNALS.md
      // seccion 26.
      server.createContext("/automation/job/execute",
          exchange -> guarded(exchange, () -> respond(exchange, 200, JobOperationsService.executeJob(readJsonBody(exchange)))));
      server.createContext("/automation/job/open", exchange -> guarded(exchange, () -> handleNodeOperation(exchange, "openJob")));
      // Generar el codigo toca widgets (validateSyntax), asi que va en la UI, y tarda
      // varios segundos: de ahi el tiempo de espera largo.
      server.createContext("/automation/job/compile", exchange -> guarded(exchange, () -> handleCompile(exchange)));
      server.createContext("/automation/job/problems", exchange -> guarded(exchange, () -> handleNodeOperation(exchange, "problems")));
      // Los contextos (entornos) del job: se editan con la API de Studio, no
      // escribiendo el XML a mano.
      server.createContext("/automation/job/contexts", exchange -> guarded(exchange, () -> handleNodeOperation(exchange, "contexts")));
      // Memoria del JVM: las mediciones largas llenan el heap y el IDE deja de
      // responder. Con esta ruta se ve cuanto queda.
      server.createContext("/automation/memory", exchange -> guarded(exchange, () -> respond(exchange, 200, JobOperationsService.memory(readJsonBody(exchange)))));
      server.createContext("/automation/job/contexts/create", exchange -> guarded(exchange, () -> handleNodeOperation(exchange, "createContext")));
      server.createContext("/automation/job/contexts/parameter", exchange -> guarded(exchange, () -> handleNodeOperation(exchange, "setContextParameter")));
      server.createContext("/automation/job/contexts/parameter/delete", exchange -> guarded(exchange, () -> handleNodeOperation(exchange, "deleteContextParameter")));
      server.createContext("/automation/job/contexts/delete", exchange -> guarded(exchange, () -> handleNodeOperation(exchange, "deleteContext")));
      // Los contextos del proyecto (los items de tipo Contexts del repositorio).
      server.createContext("/automation/repository/contexts", exchange -> guarded(exchange, () -> handleNodeOperation(exchange, "repositoryContexts")));
      server.createContext("/automation/repository/contexts/create", exchange -> guarded(exchange, () -> handleNodeOperation(exchange, "createRepositoryContext")));
      server.createContext("/automation/repository/contexts/parameter", exchange -> guarded(exchange, () -> handleNodeOperation(exchange, "setRepositoryContextParameter")));
      server.createContext("/automation/repository/contexts/parameter/delete", exchange -> guarded(exchange, () -> handleNodeOperation(exchange, "deleteRepositoryContextParameter")));
      server.createContext("/automation/repository/contexts/delete", exchange -> guarded(exchange, () -> handleNodeOperation(exchange, "deleteRepositoryContext")));
      server.createContext("/automation/nodes/add", exchange -> guarded(exchange, () -> handleNodeOperation(exchange, "addNode")));
      server.createContext("/automation/nodes/connect", exchange -> guarded(exchange, () -> handleNodeOperation(exchange, "connect")));
      server.createContext("/automation/nodes/update", exchange -> guarded(exchange, () -> handleNodeOperation(exchange, "updateNode")));
      server.createContext("/automation/nodes/delete", exchange -> guarded(exchange, () -> handleNodeOperation(exchange, "deleteNodes")));
      server.createContext("/automation/nodes/copy", exchange -> guarded(exchange, () -> handleNodeOperation(exchange, "copyNode")));
      server.createContext("/automation/nodes/list", exchange -> guarded(exchange, () -> handleNodeOperation(exchange, "listNodes")));
      server.createContext("/automation/nodes/schema", exchange -> guarded(exchange, () -> handleNodeOperation(exchange, "setSchema")));
      server.createContext("/automation/nodes/configure", exchange -> guarded(exchange, () -> handleNodeOperation(exchange, "configureNode")));
      server.createContext("/automation/run-code", exchange -> guarded(exchange, () -> handleRunCode(exchange)));
      server.createContext("/automation/components", exchange -> guarded(exchange, () -> respond(exchange, 200, UiThread.sync(() -> JobOperationsService.listComponents(readJsonBody(exchange))))));
      server.createContext("/automation/components/parameters", exchange -> guarded(exchange, () -> respond(exchange, 200, UiThread.sync(() -> JobOperationsService.componentParameters(readJsonBody(exchange))))));
      server.createContext("/launch/runs", exchange -> guarded(exchange, () -> respond(exchange, 200, LaunchTrackerService.runs())));
      server.createContext("/launch/run-status", exchange -> guarded(exchange, () -> handleLaunchRunStatus(exchange)));
      server.createContext("/launch/wait", exchange -> guarded(exchange, () -> handleLaunchWait(exchange)));

      executor = Executors.newFixedThreadPool(MAX_WORKER_THREADS, runnable -> {
        Thread thread = new Thread(runnable, "talend-bridge");
        thread.setDaemon(true);
        return thread;
      });
      server.setExecutor(executor);
      server.start();

      BridgeLog.info("Bridge escuchando en http://127.0.0.1:" + config.port
          + " (token en " + BridgeConfig.tokenPath() + ")");
    } catch (IOException e) {
      throw e;
    }
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

  private Map<String, Object> pingPayload() {
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("ok", true);
    payload.put("source", "studio-bridge");
    payload.put("confidence", "high");
    payload.put("endpoint", "/ping");
    payload.put("plugin", Activator.PLUGIN_ID);
    payload.put("version", pluginVersion());
    payload.put("mode", config().readOnly ? "readOnly" : "readWrite");
    payload.put("unsafeActions", config().unsafeActions);
    payload.put("hotReload", true);
    return payload;
  }

  private String pluginVersion() {
    Bundle bundle = FrameworkUtil.getBundle(BridgeServer.class);
    return bundle == null ? "unknown" : bundle.getVersion().toString();
  }

  /**
   * Aplica autenticacion, validacion de metodo y manejo de errores a todas las
   * rutas, para que ninguna respuesta quede sin cuerpo o sin contexto.
   */
  private void guarded(HttpExchange exchange, ThrowingAction action) throws IOException {
    String path = exchange.getHttpContext().getPath();

    if ("/ping".equals(path)) {
      action.run();
      return;
    }

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

    try {
      action.run();
    } catch (PayloadTooLargeException e) {
      respond(exchange, 413, errorPayload(path, "PAYLOAD_TOO_LARGE", e.getMessage()));
    } catch (BadRequestException e) {
      respond(exchange, 400, errorPayload(path, e.code, e.getMessage()));
    } catch (RuntimeException e) {
      BridgeLog.error("Fallo atendiendo " + path, e);
      String message = e.getMessage() == null ? e.toString() : e.getMessage();
      respond(exchange, 500, errorPayload(path, "INTERNAL_ERROR", message));
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

  private void handleExecuteCommand(HttpExchange exchange) throws IOException {
    JsonObject body = readJsonBody(exchange);
    String commandId = optString(body, "commandId");
    if (commandId == null || commandId.trim().isEmpty()) {
      throw new BadRequestException("MISSING_PARAMETER", "Falta el parametro 'commandId'");
    }
    boolean dryRun = optBoolean(body, "dryRun", true);
    respond(exchange, 200, UiThread.sync(() -> CommandAuditService.executeCommand(commandId, dryRun, config())));
  }

  private void handleLaunchRun(HttpExchange exchange) throws IOException {
    JsonObject body = readJsonBody(exchange);
    String name = optString(body, "name");
    if (name == null || name.trim().isEmpty()) {
      throw new BadRequestException("MISSING_PARAMETER", "Falta el parametro 'name'");
    }
    String mode = optString(body, "mode");
    boolean dryRun = optBoolean(body, "dryRun", true);
    respond(exchange, 200, LaunchConfigService.runLaunchConfig(name, mode, dryRun, config()));
  }

  private void handleOpenResource(HttpExchange exchange) throws IOException {
    JsonObject body = readJsonBody(exchange);
    String path = optString(body, "path");
    if (path == null || path.trim().isEmpty()) {
      throw new BadRequestException("MISSING_PARAMETER", "Falta el parametro 'path'");
    }
    respond(exchange, 200, UiThread.sync(() -> WorkbenchService.openResource(path)));
  }

  private void handleCloseEditor(HttpExchange exchange) throws IOException {
    JsonObject body = readJsonBody(exchange);
    String title = optString(body, "title");
    if (title == null || title.trim().isEmpty()) {
      throw new BadRequestException("MISSING_PARAMETER", "Falta el parametro 'title'");
    }
    boolean save = optBoolean(body, "save", true);
    respond(exchange, 200, UiThread.sync(() -> WorkbenchService.closeEditor(title, save)));
  }

  private void handleActivateEditor(HttpExchange exchange) throws IOException {
    JsonObject body = readJsonBody(exchange);
    String title = optString(body, "title");
    if (title == null || title.trim().isEmpty()) {
      throw new BadRequestException("MISSING_PARAMETER", "Falta el parametro 'title'");
    }
    respond(exchange, 200, UiThread.sync(() -> WorkbenchService.activateEditor(title)));
  }

  private void handleFindEditor(HttpExchange exchange) throws IOException {
    JsonObject body = readJsonBody(exchange);
    String titleContains = optString(body, "titleContains");
    if (titleContains == null || titleContains.isEmpty()) {
      titleContains = queryParam(exchange, "titleContains");
    }
    if (titleContains == null || titleContains.isEmpty()) {
      throw new BadRequestException("MISSING_PARAMETER", "Falta el parametro 'titleContains'");
    }
    final String finalTitle = titleContains;
    respond(exchange, 200, UiThread.sync(() -> WorkbenchService.findEditor(finalTitle)));
  }

  private void handleShowView(HttpExchange exchange) throws IOException {
    JsonObject body = readJsonBody(exchange);
    String viewId = optString(body, "viewId");
    if (viewId == null || viewId.trim().isEmpty()) {
      throw new BadRequestException("MISSING_PARAMETER", "Falta el parametro 'viewId'");
    }
    respond(exchange, 200, UiThread.sync(() -> WorkbenchService.showView(viewId)));
  }

  private void handleActiveComponentDetails(HttpExchange exchange) throws IOException {
    JsonObject body = readJsonBody(exchange);
    String uniqueName = optString(body, "uniqueName");
    if (uniqueName == null || uniqueName.trim().isEmpty()) {
      uniqueName = queryParam(exchange, "uniqueName");
    }
    if (uniqueName == null || uniqueName.trim().isEmpty()) {
      throw new BadRequestException("MISSING_PARAMETER", "Falta el parametro 'uniqueName'");
    }
    boolean includeRaw = optBoolean(body, "includeRaw", false);
    final String finalUniqueName = uniqueName;
    final boolean finalIncludeRaw = includeRaw;
    respond(exchange, 200, UiThread.sync(() -> TalendIntrospectionService.activeComponentDetails(finalUniqueName, finalIncludeRaw)));
  }

  private void handleSelectComponent(HttpExchange exchange) throws IOException {
    JsonObject body = readJsonBody(exchange);
    String uniqueName = optString(body, "uniqueName");
    if (uniqueName == null || uniqueName.trim().isEmpty()) {
      uniqueName = queryParam(exchange, "uniqueName");
    }
    if (uniqueName == null || uniqueName.trim().isEmpty()) {
      throw new BadRequestException("MISSING_PARAMETER", "Falta el parametro 'uniqueName'");
    }
    final String finalUniqueName = uniqueName;
    respond(exchange, 200, UiThread.sync(() -> TalendIntrospectionService.selectComponent(finalUniqueName)));
  }

  private void handleAutomationRunActiveJob(HttpExchange exchange) throws IOException {
    JsonObject body = readJsonBody(exchange);
    boolean dryRun = optBoolean(body, "dryRun", true);
    boolean saveBefore = optBoolean(body, "saveBefore", true);
    boolean waitForTermination = optBoolean(body, "waitForTermination", true);
    int timeoutMs = optInt(body, "timeoutMs", 120000);

    // Ojo: la ejecucion NO va dentro de UiThread.sync. Lanzar el job y esperar
    // su terminacion tarda decenas de segundos y bloquearia el hilo de la UI,
    // congelando Talend Studio.
    respond(exchange, 200, AutomationService.runActiveJob(saveBefore, waitForTermination, timeoutMs, dryRun, config()));
  }

  /**
   * Opera sobre los nodos del job abierto en Talend.
   *
   * Las operaciones usan la API del IDE, de modo que cada nodo nace con sus
   * parametros y valores por defecto y el XML lo escribe Studio.
   */
  private void handleNodeOperation(HttpExchange exchange, String operation) throws IOException {
    JsonObject body = readJsonBody(exchange);

    // Ejecutar el job lanza una JVM aparte y espera su salida (hasta minutos):
    // en el hilo de la UI congelaria Studio. Solo lee el workspace, sin widgets.
    if ("executeJob".equals(operation)) {
      respond(exchange, 200, JobOperationsService.executeJob(body));
      return;
    }

    respond(exchange, 200, UiThread.sync(() -> {
      switch (operation) {
        case "createJob":
          return JobOperationsService.createJob(body);
        case "deleteJob":
          return JobOperationsService.deleteJob(body);
        case "executeJob":
          return JobOperationsService.executeJob(body);
        case "openJob":
          return JobOperationsService.openJob(body);
        case "addNode":
          return JobOperationsService.addNode(body);
        case "connect":
          return JobOperationsService.connect(body);
        case "updateNode":
          return JobOperationsService.updateNode(body);
        case "deleteNodes":
          return JobOperationsService.deleteNodes(body);
        case "copyNode":
          return JobOperationsService.copyNode(body);
        case "setSchema":
          return JobOperationsService.setSchema(body);
        case "configureNode":
          return JobOperationsService.configureNode(body);
        case "problems":
          return JobOperationsService.problems(body);
        case "contexts":
          return JobOperationsService.contexts(body);
        case "createContext":
          return JobOperationsService.createContext(body);
        case "setContextParameter":
          return JobOperationsService.setContextParameter(body);
        case "deleteContextParameter":
          return JobOperationsService.deleteContextParameter(body);
        case "deleteContext":
          return JobOperationsService.deleteContext(body);
        case "repositoryContexts":
          return JobOperationsService.repositoryContexts(body);
        case "createRepositoryContext":
          return JobOperationsService.createRepositoryContext(body);
        case "setRepositoryContextParameter":
          return JobOperationsService.setRepositoryContextParameter(body);
        case "deleteRepositoryContextParameter":
          return JobOperationsService.deleteRepositoryContextParameter(body);
        case "deleteRepositoryContext":
          return JobOperationsService.deleteRepositoryContext(body);
        default:
          return JobOperationsService.listNodes(body);
      }
    }));
  }

  private void handleCompile(HttpExchange exchange) throws IOException {
    JsonObject body = readJsonBody(exchange);
    respond(exchange, 200, UiThread.sync(() -> JobOperationsService.compile(body), 180_000L));
  }

  /**
   * Ejecuta codigo Java dentro de Studio.
   *
   * El codigo ve las mismas APIs que ve el IDE. Solo corre si las acciones
   * inseguras estan habilitadas: ejecutar codigo arbitrario puede tocar el
   * workspace de forma irreversible.
   */
  private void handleRunCode(HttpExchange exchange) throws IOException {
    JsonObject body = readJsonBody(exchange);
    BridgeConfig current = config();
    if (current.readOnly) {
      throw new BadRequestException("READ_ONLY", "El bridge esta en modo readOnly");
    }
    if (!current.unsafeActions) {
      throw new BadRequestException("UNSAFE_ACTIONS_DISABLED",
          "La ejecucion de codigo requiere unsafeActions=true");
    }
    respond(exchange, 200, CodeRunnerService.run(body));
  }

  private void handleLaunchRunStatus(HttpExchange exchange) throws IOException {    JsonObject body = readJsonBody(exchange);
    String launchId = optString(body, "launchId");
    if (launchId == null || launchId.trim().isEmpty()) {
      launchId = queryParam(exchange, "launchId");
    }
    if (launchId == null || launchId.trim().isEmpty()) {
      throw new BadRequestException("MISSING_PARAMETER", "Falta el parametro 'launchId'");
    }
    respond(exchange, 200, LaunchTrackerService.runStatus(launchId));
  }

  private void handleLaunchWait(HttpExchange exchange) throws IOException {
    JsonObject body = readJsonBody(exchange);
    String launchId = optString(body, "launchId");
    if (launchId == null || launchId.trim().isEmpty()) {
      launchId = queryParam(exchange, "launchId");
    }
    if (launchId == null || launchId.trim().isEmpty()) {
      throw new BadRequestException("MISSING_PARAMETER", "Falta el parametro 'launchId'");
    }
    int timeoutMs = optInt(body, "timeoutMs", 60000);
    LaunchTrackerService.LaunchRunInfo info = LaunchTrackerService.waitForLaunch(launchId, timeoutMs);
    if (info != null && info.terminatedAt != null) {
      respond(exchange, 200, LaunchTrackerService.runStatus(launchId));
      return;
    }
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("ok", true);
    payload.put("source", "studio-bridge");
    payload.put("confidence", "high");
    payload.put("endpoint", "/launch/wait");
    payload.put("timedOut", true);
    payload.put("launchId", launchId);
    respond(exchange, 200, payload);
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
    } catch (com.google.gson.JsonParseException e) {
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
