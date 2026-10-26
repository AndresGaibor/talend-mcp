import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { McpServer } from "@modelcontextprotocol/server";
import { NodeStreamableHTTPServerTransport } from "@modelcontextprotocol/node";
import { getRuntimeTools } from "../../../server/registered-tools";
import { toCallToolResult } from "../call-tool-result";
import { handleMcpRequest, jsonRpcError, jsonRpcOk, sendJson } from "../json-rpc";
import { createNewMcpServer } from "./common";
import { handleEarlyRoute, readBody } from "./http-routes";
import type { NewServerHandle, NewServerOptions } from "./types";

// ─── Main HTTP server factory ─────────────────────────────────────────────────

export async function runNewHttpServer(options?: NewServerOptions): Promise<NewServerHandle> {
  const host = options?.host ?? "127.0.0.1";
  const port = options?.port ?? 3927;
  const path = "/mcp";

  // El catalogo de tools se arma una sola vez: `tools/list` y `tools/call`
  // responden directo sobre el. El servidor MCP y su transporte SSE, en cambio,
  // se crean solo si un cliente pide streaming: registrar 200+ tools con sus
  // esquemas es lo mas caro del arranque y casi ningun cliente lo necesita.
  const runtimeTools = getRuntimeTools();
  const toolsJson = JSON.stringify(runtimeTools.map(({ definition: t }) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema ?? { type: "object", properties: {} },
    outputSchema: t.outputSchema,
    ...(t.annotations ? { annotations: t.annotations } : {}),
  })));
  const toolsByName = new Map(runtimeTools.map((tool) => [tool.definition.name, tool]));

  let mcpServer: McpServer | null = null;
  let sseTransport: NodeStreamableHTTPServerTransport | null = null;

  async function streamingTransport(): Promise<NodeStreamableHTTPServerTransport> {
    if (sseTransport) return sseTransport;
    mcpServer ??= createNewMcpServer();
    sseTransport = new NodeStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    await mcpServer.connect(sseTransport);
    return sseTransport;
  }

  const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const earlyHandled = await handleEarlyRoute(req, res, {
      host,
      port,
      path,
      toolCount: runtimeTools.length,
      streamingTransport,
    });
    if (earlyHandled) return;

    // ── POST /mcp ──
    if (req.method !== "POST") {
      res.writeHead(405, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "method_not_allowed" }));
      return;
    }

    const origin = req.headers.origin;
    const accept = req.headers.accept ?? "";

    // Se lee el cuerpo antes de decidir que metodo atender.
    let body: string;
    try {
      body = await readBody(req);
    } catch {
      res.writeHead(400, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "bad_request" }));
      return;
    }

    let parsed: { jsonrpc?: string; id?: unknown; method?: string; params?: unknown };
    try {
      parsed = JSON.parse(body);
    } catch {
      sendJson(res, origin, jsonRpcError(null, -32700, "Parse error"));
      return;
    }

    // Si el cliente pide solo SSE, se delega el transporte completo: ese camino
    // mantiene la sesion y el streaming que algunos clientes esperan.
    const wantsOnlySSE = accept.includes("text/event-stream") && !accept.includes("application/json");

    if (wantsOnlySSE) {
      req.headers.accept = accept;
      await (await streamingTransport()).handleRequest(req, res);
      return;
    }

    // ── Despacho JSON-RPC directo (sin SSE) ──────────────────────────────────
    // `initialize`, `tools/list`, `ping` y las notificaciones se responden como
    // una respuesta HTTP completa, con `Connection: close`.

    const method = parsed.method;
    const id = parsed.id;

    const handled = handleMcpRequest(parsed, origin, res, toolsJson);
    if (handled) return;

    // `tools/call` es el unico metodo que necesita ejecutar el handler.
    if (method === "tools/call") {
      const p = (parsed.params ?? {}) as { name?: string; arguments?: unknown };
      const toolName = p.name;
      if (!toolName) {
        sendJson(res, origin, jsonRpcError(id, -32602, "Missing tool name"));
        return;
      }
      const tool = toolsByName.get(toolName);
      if (!tool) {
        sendJson(res, origin, jsonRpcError(id, -32602, `Tool not found: ${toolName}`));
        return;
      }
      try {
        const result = await tool.handler(p.arguments ?? {});
        sendJson(res, origin, jsonRpcOk(id, toCallToolResult(result)));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        sendJson(res, origin, jsonRpcOk(id, {
          content: [{ type: "text", text: `Error: ${msg}` }],
          isError: true,
        }));
      }
      return;
    }

    // Metodo desconocido.
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

  return {
    localUrl,
    async close() {
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
      if (mcpServer) await mcpServer.close();
    },
  };
}
