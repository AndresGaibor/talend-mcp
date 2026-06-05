import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { spawn } from "node:child_process";
import { McpServer } from "@modelcontextprotocol/server";
import { StdioServerTransport } from "@modelcontextprotocol/server";
import { NodeStreamableHTTPServerTransport } from "@modelcontextprotocol/node";
import { listPresentationAppIds, registerPresentationAppResources } from "../apps";
import { getAllRuntimeTools, getRuntimeTools } from "../../server/registered-tools";
import { GENERIC_TOOL_OUTPUT_SCHEMA } from "./tool-registry";
import { resolvePublicUrl } from "../../tailscale/resolve-public-url";

export interface NewServerOptions {
  port?: number;
  host?: string;
  autoFunnel?: boolean;
  live?: boolean;
}

export interface NewServerHandle {
  localUrl: string;
  publicUrl: string | null;
  close(): Promise<void>;
}

function createHealthPayload() {
  return {
    ok: true,
    service: "talend-mcp",
    version: "1.0.0",
    toolCount: getAllRuntimeTools().length + listPresentationAppIds().length,
  };
}

function isLocalOrigin(origin: string): boolean {
  return origin.startsWith("http://127.0.0.1:") || origin.startsWith("http://localhost:");
}

function isOpenAIOrigin(origin: string): boolean {
  return origin === "https://chatgpt.com" || origin === "https://chat.openai.com" || origin.endsWith(".openai.com");
}

function isAllowedOrigin(origin: string | undefined, allowOrigins: string[] = []): boolean {
  if (!origin) return true;
  if (allowOrigins.includes("*")) return true;
  if (allowOrigins.includes(origin)) return true;
  return isLocalOrigin(origin) || isOpenAIOrigin(origin);
}

async function runProcess(command: string, args: string[], timeoutMs = 10_000): Promise<{ ok: boolean; stdout: string; stderr: string }> {
  return await new Promise((resolve) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      if (process.platform === "win32") {
        spawn("taskkill", ["/F", "/T", "/PID", String(child.pid)]);
      } else {
        child.kill("SIGKILL");
      }
    }, timeoutMs);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("close", (exitCode) => {
      clearTimeout(timer);
      resolve({ ok: exitCode === 0, stdout, stderr });
    });
    child.on("error", () => {
      clearTimeout(timer);
      resolve({ ok: false, stdout, stderr });
    });
  });
}

export function createNewMcpServer(options?: { live?: boolean; stderr?: NodeJS.WritableStream }) {
  const server = new McpServer({ name: "talend-mcp", version: "1.0.0" });
  const allTools = getRuntimeTools();

  for (const tool of allTools) {
    server.registerTool(
      tool.definition.name,
      {
        description: tool.definition.description,
        inputSchema: tool.definition.inputSchema as Parameters<typeof server.registerTool>[1]["inputSchema"],
        outputSchema: (tool.definition.outputSchema ?? GENERIC_TOOL_OUTPUT_SCHEMA) as Parameters<typeof server.registerTool>[1]["outputSchema"],
        annotations: tool.definition.annotations as Parameters<typeof server.registerTool>[1]["annotations"],
      },
      tool.handler as never,
    );
  }

  registerPresentationAppResources(server);

  return server;
}

export const createTalendMcpServer = createNewMcpServer;

export async function runNewStdioServer(options?: { live?: boolean }): Promise<void> {
  const server = createNewMcpServer({ live: options?.live, stderr: process.stderr });
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// ─── JSON-RPC helpers ─────────────────────────────────────────────────────────

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk: string) => { body += chunk; });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function jsonRpcOk(id: unknown, result: unknown) {
  return { jsonrpc: "2.0", id: id ?? null, result };
}

function jsonRpcError(id: unknown, code: number, message: string) {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message } };
}

function sendJson(res: ServerResponse, origin: string | undefined, payload: unknown) {
  const json = JSON.stringify(payload);
  res.writeHead(200, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(json),
    "access-control-allow-origin": origin ?? "*",
    "connection": "close",
  });
  res.end(json);
}

function sendAccepted(res: ServerResponse, origin: string | undefined) {
  res.writeHead(202, {
    "content-type": "application/json",
    "access-control-allow-origin": origin ?? "*",
    "connection": "close",
  });
  res.end("{}");
}

// ─── MCP request dispatcher ───────────────────────────────────────────────────
// Handles all standard MCP JSON-RPC methods directly, without SSE streaming.
// This is required for the OpenAI tunnel-client which expects real HTTP responses.

function buildServerCapabilities() {
  return {
    tools: { listChanged: false },
    resources: { listChanged: false },
    prompts: { listChanged: false },
  };
}

function handleMcpRequest(
  parsed: { jsonrpc?: string; id?: unknown; method?: string; params?: unknown },
  origin: string | undefined,
  res: ServerResponse,
  mcpServer: McpServer,
): boolean {
  const { id, method, params } = parsed;

  if (method === "initialize") {
    sendJson(res, origin, jsonRpcOk(id, {
      protocolVersion: "2024-11-05",
      serverInfo: { name: "talend-mcp", version: "1.0.0" },
      capabilities: buildServerCapabilities(),
    }));
    return true;
  }

  if (method === "notifications/initialized" || method === "ping") {
    // Notifications have no id, just acknowledge
    sendAccepted(res, origin);
    return true;
  }

  if (method === "tools/list") {
    const tools = getAllRuntimeTools().map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema ?? { type: "object", properties: {} },
      outputSchema: t.outputSchema,
      ...(t.annotations ? { annotations: t.annotations } : {}),
    }));
    sendJson(res, origin, jsonRpcOk(id, { tools }));
    return true;
  }

  if (method === "tools/call") {
    // Tool calls need the full server, handle async below
    return false;
  }

  if (method === "resources/list") {
    sendJson(res, origin, jsonRpcOk(id, { resources: [] }));
    return true;
  }

  if (method === "prompts/list") {
    sendJson(res, origin, jsonRpcOk(id, { prompts: [] }));
    return true;
  }

  // Unknown method
  sendJson(res, origin, jsonRpcError(id, -32601, `Method not found: ${method}`));
  return true;
}

// ─── Main HTTP server factory ─────────────────────────────────────────────────

export async function runNewHttpServer(options?: NewServerOptions): Promise<NewServerHandle> {
  const host = options?.host ?? "127.0.0.1";
  const port = options?.port ?? 3927;
  const path = "/mcp";

  // Create one McpServer for stateful tool calls (tools/call), plus one SSE transport
  // for clients that want full streaming MCP (e.g. Claude Desktop)
  const mcpServer = createNewMcpServer({ live: options?.live, stderr: process.stderr });
  const sseTransport = new NodeStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await mcpServer.connect(sseTransport);

  const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const requestUrl = new URL(req.url ?? "/", `http://${req.headers.host ?? `${host}:${port}`}`);

    // ── CORS preflight ──
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "access-control-allow-origin": req.headers.origin ?? "*",
        "access-control-allow-methods": "GET, POST, OPTIONS",
        "access-control-allow-headers": "content-type, accept, authorization",
        "access-control-max-age": "86400",
      });
      res.end();
      return;
    }

    // ── Health endpoint ──
    if (requestUrl.pathname === "/healthz") {
      const payload = createHealthPayload();
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(payload));
      return;
    }

    if (requestUrl.pathname !== path) {
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "not_found" }));
      return;
    }

    const origin = req.headers.origin;
    if (!isAllowedOrigin(origin, [])) {
      res.writeHead(403, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "origin_denied" }));
      return;
    }

    const accept = req.headers.accept ?? "";

    // ── GET /mcp with SSE → delegate to streaming transport (Claude Desktop etc.) ──
    if (req.method === "GET") {
      if (accept.includes("text/event-stream")) {
        await sseTransport.handleRequest(req, res);
      } else {
        const payload = createHealthPayload();
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify(payload));
      }
      return;
    }

    // ── POST /mcp ──
    if (req.method !== "POST") {
      res.writeHead(405, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "method_not_allowed" }));
      return;
    }

    // Read body first so we can inspect the method
    let body: string;
    try {
      body = await readBody(req);
    } catch {
      res.writeHead(400, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "bad_request" }));
      return;
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(body);
    } catch {
      sendJson(res, origin, jsonRpcError(null, -32700, "Parse error"));
      return;
    }

    // If client explicitly requests SSE AND it's not a simple method we can handle directly,
    // delegate to the SSE transport using a reconstructed readable stream
    const wantsOnlySSE = accept.includes("text/event-stream") && !accept.includes("application/json");

    if (wantsOnlySSE) {
      // Pass through to SSE transport
      req.headers.accept = accept;
      await sseTransport.handleRequest(req, res);
      return;
    }

    // ── Direct JSON-RPC dispatch (no SSE) ─────────────────────────────────────
    // Handles initialize, tools/list, tools/call, notifications, etc.
    // Responds with Connection: close — required for OpenAI tunnel-client compatibility.

    const method = parsed.method as string | undefined;
    const id = parsed.id;

    // Handle simple stateless methods synchronously
    const handled = handleMcpRequest(parsed as any, origin, res, mcpServer);
    if (handled) return;

    // tools/call — invoke the actual tool handler
    if (method === "tools/call") {
      const p = (parsed.params ?? {}) as { name?: string; arguments?: unknown };
      const toolName = p.name;
      if (!toolName) {
        sendJson(res, origin, jsonRpcError(id, -32602, "Missing tool name"));
        return;
      }
      const runtimeTools = getRuntimeTools();
      const tool = runtimeTools.find((t) => t.definition.name === toolName);
      if (!tool) {
        sendJson(res, origin, jsonRpcError(id, -32602, `Tool not found: ${toolName}`));
        return;
      }
      try {
        const result = await tool.handler(p.arguments ?? {});
        sendJson(res, origin, jsonRpcOk(id, { content: [{ type: "text", text: typeof result === "string" ? result : JSON.stringify(result, null, 2) }] }));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        sendJson(res, origin, jsonRpcOk(id, {
          content: [{ type: "text", text: `Error: ${msg}` }],
          isError: true,
        }));
      }
      return;
    }

    // Fallback: unknown method
    sendJson(res, origin, jsonRpcError(id, -32601, `Method not found: ${method}`));
  });

  const listenPort = await new Promise<number>((resolve, reject) => {
    const listen = (p: number): void => {
      const onError = (error: NodeJS.ErrnoException): void => {
        httpServer.off("error", onError);
        if (error.code === "EADDRINUSE" && p !== 0) { listen(0); return; }
        reject(error);
      };
      httpServer.once("error", onError);
      httpServer.listen(p, host, () => {
        httpServer.off("error", onError);
        const addr = httpServer.address();
        if (addr && typeof addr === "object") { resolve(addr.port); return; }
        reject(new Error("Could not determine port"));
      });
    };
    listen(port);
  });

  const localUrl = `http://${host}:${listenPort}`;
  let publicUrl: string | null = null;

  if (options?.autoFunnel !== false) {
    const tsStatus = await runProcess("tailscale", ["status", "--json"], 10_000);
    if (tsStatus.ok) {
      const funnelResult = await runProcess("tailscale", ["funnel", "--bg", "--yes", "--https=443", String(listenPort)], 15_000);
      if (funnelResult.ok) {
        publicUrl = await resolvePublicUrl({
          path: "/mcp",
          timeoutMs: 15_000,
          intervalMs: 1_000,
          readTailscaleStatus: async () =>
            (await runProcess("tailscale", ["status", "--json"])).stdout,
          readFunnelStatus: async () =>
            (await runProcess("tailscale", ["funnel", "status", "--json"])).stdout,
          publicPort: 443,
        });
      }
    }
  }

  return {
    localUrl,
    publicUrl,
    async close() {
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    },
  };
}
