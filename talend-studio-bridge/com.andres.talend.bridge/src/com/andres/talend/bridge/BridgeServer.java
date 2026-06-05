package com.andres.talend.bridge;

import java.io.IOException;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import com.andres.talend.bridge.audit.CapabilityAuditService;
import com.andres.talend.bridge.audit.CommandAuditService;
import com.andres.talend.bridge.audit.PluginAuditService;
import com.andres.talend.bridge.events.EventsService;
import com.andres.talend.bridge.launch.LaunchConfigService;
import com.andres.talend.bridge.launch.LaunchTrackerService;
import com.andres.talend.bridge.problems.ProblemMarkerService;
import com.andres.talend.bridge.resources.WorkspaceService;
import com.andres.talend.bridge.talend.TalendClassProbeService;
import com.andres.talend.bridge.talend.TalendIntrospectionService;
import com.andres.talend.bridge.workbench.WorkbenchService;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

import org.osgi.framework.BundleContext;

final class BridgeServer {
  private interface ThrowingAction {
    void run() throws IOException;
  }

  private final BundleContext bundleContext;
  private final BridgeConfig config;
  private final String token;
  private HttpServer server;

  BridgeServer(BundleContext bundleContext) {
    this.bundleContext = bundleContext;
    this.config = BridgeConfig.load();
    this.token = BridgeConfig.ensureToken();
  }

  void start() {
    try {
      server = HttpServer.create(new InetSocketAddress("127.0.0.1", config.port), 0);
      server.createContext("/ping", exchange -> respond(exchange, 200, pingPayload()));
      server.createContext("/capabilities", exchange -> guarded(exchange, () -> respond(exchange, 200, CapabilityAuditService.capabilities(config))));
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
      server.createContext("/launch/runs", exchange -> guarded(exchange, () -> respond(exchange, 200, LaunchTrackerService.runs())));
      server.createContext("/launch/run-status", exchange -> guarded(exchange, () -> handleLaunchRunStatus(exchange)));
      server.createContext("/launch/wait", exchange -> guarded(exchange, () -> handleLaunchWait(exchange)));
      server.setExecutor(java.util.concurrent.Executors.newCachedThreadPool());
      server.start();
    } catch (IOException e) {
      throw new IllegalStateException("No se pudo iniciar el bridge HTTP", e);
    }
  }

  void stop() {
    if (server != null) {
      server.stop(0);
      server = null;
    }
  }

  private Map<String, Object> pingPayload() {
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("ok", true);
    payload.put("source", "studio-bridge");
    payload.put("confidence", "high");
    payload.put("endpoint", "/ping");
    payload.put("plugin", Activator.PLUGIN_ID);
    payload.put("version", "0.1.0");
    payload.put("mode", config.readOnly ? "readOnly" : "readWrite");
    payload.put("unsafeActions", config.unsafeActions);
    return payload;
  }

  private void guarded(HttpExchange exchange, ThrowingAction action) throws IOException {
    if (!"/ping".equals(exchange.getHttpContext().getPath()) && !authorized(exchange)) {
      respond(exchange, 401, errorPayload("AUTH_REQUIRED", "Falta Authorization: Bearer <token>"));
      return;
    }
    action.run();
  }

  private boolean authorized(HttpExchange exchange) {
    String header = exchange.getRequestHeaders().getFirst("Authorization");
    if (header == null || !header.startsWith("Bearer ")) {
      return false;
    }
    return token.equals(header.substring("Bearer ".length()).trim());
  }

  private void handleExecuteCommand(HttpExchange exchange) throws IOException {
    Map<String, Object> body = readJsonBody(exchange);
    String commandId = asString(body.get("commandId"));
    boolean dryRun = asBoolean(body.get("dryRun"), true);
    respond(exchange, 200, UiThread.sync(() -> CommandAuditService.executeCommand(commandId, dryRun, config)));
  }

  private void handleLaunchRun(HttpExchange exchange) throws IOException {
    Map<String, Object> body = readJsonBody(exchange);
    String name = asString(body.get("name"));
    String mode = asString(body.get("mode"));
    boolean dryRun = asBoolean(body.get("dryRun"), true);
    respond(exchange, 200, LaunchConfigService.runLaunchConfig(name, mode, dryRun, config));
  }

  private void handleOpenResource(HttpExchange exchange) throws IOException {
    Map<String, Object> body = readJsonBody(exchange);
    String path = asString(body.get("path"));
    respond(exchange, 200, UiThread.sync(() -> WorkbenchService.openResource(path)));
  }

  private void handleCloseEditor(HttpExchange exchange) throws IOException {
    Map<String, Object> body = readJsonBody(exchange);
    String title = asString(body.get("title"));
    boolean save = asBoolean(body.get("save"), true);
    respond(exchange, 200, UiThread.sync(() -> WorkbenchService.closeEditor(title, save)));
  }

  private void handleActivateEditor(HttpExchange exchange) throws IOException {
    Map<String, Object> body = readJsonBody(exchange);
    String title = asString(body.get("title"));
    respond(exchange, 200, UiThread.sync(() -> WorkbenchService.activateEditor(title)));
  }

  private void handleFindEditor(HttpExchange exchange) throws IOException {
    Map<String, Object> body = readJsonBody(exchange);
    String titleContains = asString(body.get("titleContains"));
    if (titleContains == null || titleContains.isEmpty()) {
      titleContains = queryParam(exchange, "titleContains");
    }
    final String finalTitle = titleContains;
    respond(exchange, 200, UiThread.sync(() -> WorkbenchService.findEditor(finalTitle)));
  }

  private void handleShowView(HttpExchange exchange) throws IOException {
    Map<String, Object> body = readJsonBody(exchange);
    String viewId = asString(body.get("viewId"));
    respond(exchange, 200, UiThread.sync(() -> WorkbenchService.showView(viewId)));
  }

  private void handleActiveComponentDetails(HttpExchange exchange) throws IOException {
    Map<String, Object> body = readJsonBody(exchange);
    String uniqueName = asString(body.get("uniqueName"));
    if (uniqueName == null || uniqueName.trim().isEmpty()) {
      uniqueName = queryParam(exchange, "uniqueName");
    }
    boolean includeRaw = asBoolean(body.get("includeRaw"), false);
    final String finalUniqueName = uniqueName;
    final boolean finalIncludeRaw = includeRaw;
    respond(exchange, 200, UiThread.sync(() -> TalendIntrospectionService.activeComponentDetails(finalUniqueName, finalIncludeRaw)));
  }

  private void handleSelectComponent(HttpExchange exchange) throws IOException {
    Map<String, Object> body = readJsonBody(exchange);
    String uniqueName = asString(body.get("uniqueName"));
    if (uniqueName == null || uniqueName.trim().isEmpty()) {
      uniqueName = queryParam(exchange, "uniqueName");
    }
    final String finalUniqueName = uniqueName;
    respond(exchange, 200, UiThread.sync(() -> TalendIntrospectionService.selectComponent(finalUniqueName)));
  }

  private void handleAutomationRunActiveJob(HttpExchange exchange) throws IOException {
    Map<String, Object> body = readJsonBody(exchange);
    boolean dryRun = asBoolean(body.get("dryRun"), true);
    boolean saveBefore = asBoolean(body.get("saveBefore"), true);
    boolean waitForTermination = asBoolean(body.get("waitForTermination"), true);
    int timeoutMs = asInt(body.get("timeoutMs"), 120000);
    respond(exchange, 200, UiThread.sync(() -> AutomationService.runActiveJob(saveBefore, waitForTermination, timeoutMs, dryRun, config)));
  }

  private void handleLaunchRunStatus(HttpExchange exchange) throws IOException {
    Map<String, Object> body = readJsonBody(exchange);
    String launchId = asString(body.get("launchId"));
    if (launchId == null || launchId.trim().isEmpty()) {
      launchId = queryParam(exchange, "launchId");
    }
    respond(exchange, 200, LaunchTrackerService.runStatus(launchId));
  }

  private void handleLaunchWait(HttpExchange exchange) throws IOException {
    Map<String, Object> body = readJsonBody(exchange);
    String launchId = asString(body.get("launchId"));
    if (launchId == null || launchId.trim().isEmpty()) {
      launchId = queryParam(exchange, "launchId");
    }
    int timeoutMs = asInt(body.get("timeoutMs"), 60000);
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

  private Map<String, Object> readJsonBody(HttpExchange exchange) throws IOException {
    try (InputStream inputStream = exchange.getRequestBody()) {
      ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
      byte[] buffer = new byte[1024];
      int read;
      while ((read = inputStream.read(buffer)) != -1) {
        outputStream.write(buffer, 0, read);
      }
      String body = new String(outputStream.toByteArray(), StandardCharsets.UTF_8).trim();
      if (body.isEmpty()) {
        return new HashMap<>();
      }
      Map<String, Object> payload = new HashMap<>();
      String commandId = extractString(body, "commandId");
      if (commandId != null) payload.put("commandId", commandId);
      String name = extractString(body, "name");
      if (name != null) payload.put("name", name);
      String mode = extractString(body, "mode");
      if (mode != null) payload.put("mode", mode);
      String path = extractString(body, "path");
      if (path != null) payload.put("path", path);
      String uniqueName = extractString(body, "uniqueName");
      if (uniqueName != null) payload.put("uniqueName", uniqueName);
      if (body.contains("\"includeRaw\":true")) payload.put("includeRaw", Boolean.TRUE);
      if (body.contains("\"includeRaw\":false")) payload.put("includeRaw", Boolean.FALSE);
      if (body.contains("\"dryRun\":true")) payload.put("dryRun", Boolean.TRUE);
      if (body.contains("\"dryRun\":false")) payload.put("dryRun", Boolean.FALSE);
      if (body.contains("\"saveBefore\":true")) payload.put("saveBefore", Boolean.TRUE);
      if (body.contains("\"saveBefore\":false")) payload.put("saveBefore", Boolean.FALSE);
      if (body.contains("\"waitForTermination\":true")) payload.put("waitForTermination", Boolean.TRUE);
      if (body.contains("\"waitForTermination\":false")) payload.put("waitForTermination", Boolean.FALSE);
      String timeoutMsStr = extractString(body, "timeoutMs");
      if (timeoutMsStr != null) {
        try { payload.put("timeoutMs", Integer.parseInt(timeoutMsStr)); } catch (NumberFormatException ignored) {}
      }
      return payload;
    }
  }

  private String extractString(String json, String key) {
    Matcher matcher = Pattern.compile("\\\"" + Pattern.quote(key) + "\\\"\\s*:\\s*\\\"(.*?)\\\"").matcher(json);
    return matcher.find() ? matcher.group(1) : null;
  }

  private void respond(HttpExchange exchange, int status, Map<String, Object> payload) throws IOException {
    byte[] bytes = JsonUtil.stringify(payload).getBytes(StandardCharsets.UTF_8);
    exchange.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
    exchange.sendResponseHeaders(status, bytes.length);
    try (OutputStream outputStream = exchange.getResponseBody()) {
      outputStream.write(bytes);
    }
  }

  private Map<String, Object> errorPayload(String code, String message) {
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("ok", false);
    payload.put("source", "studio-bridge");
    payload.put("confidence", "low");
    Map<String, Object> error = new LinkedHashMap<>();
    error.put("code", code);
    error.put("message", message);
    payload.put("error", error);
    return payload;
  }

  private String asString(Object value) {
    return value instanceof String ? (String) value : "";
  }

  private boolean asBoolean(Object value, boolean fallback) {
    return value instanceof Boolean ? (Boolean) value : fallback;
  }

  private int asInt(Object value, int fallback) {
    if (value instanceof Number) {
      return ((Number) value).intValue();
    }
    if (value instanceof String) {
      try {
        return Integer.parseInt((String) value);
      } catch (NumberFormatException ignored) {
        return fallback;
      }
    }
    return fallback;
  }
}