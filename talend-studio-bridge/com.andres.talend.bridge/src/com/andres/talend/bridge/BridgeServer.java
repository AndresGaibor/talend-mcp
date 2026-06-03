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
import com.andres.talend.bridge.launch.LaunchConfigService;
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
      server.createContext("/workspace/state", exchange -> guarded(exchange, () -> respond(exchange, 200, WorkspaceService.state())));
      server.createContext("/problems/markers", exchange -> guarded(exchange, () -> respond(exchange, 200, ProblemMarkerService.markers())));
      server.createContext("/talend/probe/classes", exchange -> guarded(exchange, () -> respond(exchange, 200, TalendClassProbeService.probe(bundleContext))));
      server.createContext("/talend/active-editor/introspect", exchange -> guarded(exchange, () -> respond(exchange, 200, UiThread.sync(TalendIntrospectionService::activeEditorIntrospect))));
      server.createContext("/talend/active-job/model", exchange -> guarded(exchange, () -> respond(exchange, 200, UiThread.sync(TalendIntrospectionService::activeJobModel))));
      server.createContext("/commands/list", exchange -> guarded(exchange, () -> respond(exchange, 200, UiThread.sync(CommandAuditService::listCommands))));
      server.createContext("/commands/execute", exchange -> guarded(exchange, () -> handleExecuteCommand(exchange)));
      server.createContext("/launch/configs", exchange -> guarded(exchange, () -> respond(exchange, 200, LaunchConfigService.listConfigs())));
      server.createContext("/launch/run", exchange -> guarded(exchange, () -> handleLaunchRun(exchange)));
      server.createContext("/events/recent", exchange -> guarded(exchange, () -> {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("ok", true);
        payload.put("source", "studio-bridge");
        payload.put("confidence", "low");
        payload.put("endpoint", "/events/recent");
        payload.put("events", new java.util.ArrayList<Object>());
        respond(exchange, 200, payload);
      }));
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
    respond(exchange, 200, LaunchConfigService.runLaunchConfig(name, mode, dryRun, BridgeConfig.load()));
  }

  private void handleOpenResource(HttpExchange exchange) throws IOException {
    Map<String, Object> body = readJsonBody(exchange);
    String path = asString(body.get("path"));
    respond(exchange, 200, UiThread.sync(() -> WorkbenchService.openResource(path)));
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
      if (body.contains("\"dryRun\":true")) payload.put("dryRun", Boolean.TRUE);
      if (body.contains("\"dryRun\":false")) payload.put("dryRun", Boolean.FALSE);
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
}
