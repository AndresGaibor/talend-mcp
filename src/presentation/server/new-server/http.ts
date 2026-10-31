import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { McpServer } from "@modelcontextprotocol/server";
import { NodeStreamableHTTPServerTransport } from "@modelcontextprotocol/node";
import { getRuntimeTools } from "../../../server/registered-tools";
import { toCallToolResult } from "../call-tool-result";
import { handleMcpRequest, jsonRpcError, jsonRpcOk, sendJson, sendJsonText } from "../json-rpc";
import { createNewMcpServer } from "./common";
import { handleEarlyRoute, PayloadTooLargeError, readBody } from "./http-routes";
import type { NewServerHandle, NewServerOptions } from "./types";
import { getTalendMcpEnv } from "../../../config/env";
import { conTiempoLimite, CupoDeLlamadas, ToolTimeoutError } from "./tool-guard";

// ─── Main HTTP server factory ─────────────────────────────────────────────────

export async function runNewHttpServer(options?: NewServerOptions): Promise<NewServerHandle> {
  const host = options?.host ?? "127.0.0.1";
  const port = options?.port ?? 3927;
  const env = getTalendMcpEnv();
  const maxBodyBytes = options?.maxBodyBytes ?? env.TALEND_MCP_MAX_BODY_BYTES;
  const toolTimeoutMs = options?.toolTimeoutMs ?? env.TALEND_MCP_TOOL_TIMEOUT_MS;
  const maxConcurrentCalls = options?.maxConcurrentCalls ?? env.TALEND_MCP_MAX_CONCURRENT_CALLS;
  const maxResponseBytes = options?.maxResponseBytes ?? env.TALEND_MCP_MAX_RESPONSE_BYTES;
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
  let activeRequests = 0;
  const cupo = new CupoDeLlamadas(maxConcurrentCalls);
  const startedAt = Date.now();

  async function streamingTransport(): Promise<NodeStreamableHTTPServerTransport> {
    if (sseTransport) return sseTransport;
    mcpServer ??= createNewMcpServer();
    sseTransport = new NodeStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    await mcpServer.connect(sseTransport);
    return sseTransport;
  }

  const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    activeRequests++;
    res.once("close", () => { activeRequests--; });

    const earlyHandled = await handleEarlyRoute(req, res, {
      host,
      port,
      path,
      toolCount: runtimeTools.length,
      startedAt,
      maxBodyBytes,
      activeRequests: () => activeRequests,
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
      body = await readBody(req, maxBodyBytes);
    } catch (error) {
      if (error instanceof PayloadTooLargeError) {
        res.writeHead(413, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: "payload_too_large", maxBytes: maxBodyBytes }));
        return;
      }
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
      if (!cupo.intentarEntrar()) {
        sendJson(res, origin, jsonRpcError(id, -32000,
          `El servidor ya tiene ${cupo.activas} llamadas en curso (maximo ${maxConcurrentCalls}): reintenta cuando alguna termine.`));
        return;
      }
      try {
        const result = await conTiempoLimite(toolName, toolTimeoutMs, () => tool.handler(p.arguments ?? {}));
        // Se serializa una sola vez y se mide antes de responder: una tool que
        // devuelve el catalogo entero no debe mandar cientos de MB por el socket.
        const texto = JSON.stringify(toCallToolResult(result));
        const bytes = Buffer.byteLength(texto, "utf8");
        if (bytes > maxResponseBytes) {
          sendJson(res, origin, jsonRpcError(id, -32000,
            `La respuesta de ${toolName} ocupa ${bytes} bytes y el tope es ${maxResponseBytes}. Pide menos datos (limit, offset o un job concreto).`));
          return;
        }
        sendJsonText(res, origin, `{"jsonrpc":"2.0","id":${JSON.stringify(id ?? null)},"result":${texto}}`);
      } catch (err: unknown) {
        if (err instanceof ToolTimeoutError) {
          sendJson(res, origin, jsonRpcError(id, -32000, err.message));
          return;
        }
        const msg = err instanceof Error ? err.message : String(err);
        sendJson(res, origin, jsonRpcOk(id, {
          content: [{ type: "text", text: `Error: ${msg}` }],
          isError: true,
        }));
      } finally {
        cupo.salir();
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
        if (error.code === "EADDRINUSE" && p !== 0) {
          // Arrancar en un puerto al azar deja al cliente llamando al puerto de
          // siempre sin saber por que no contesta. Mejor fallar y decirlo.
          reject(new Error(`El puerto ${p} de ${host} ya esta ocupado: cierra el proceso que lo usa o arranca en otro con TALEND_MCP_PORT.`));
          return;
        }
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
      // `close()` solo deja de aceptar; las conexiones keep-alive abiertas lo
      // dejarian esperando. Se cortan antes de esperar el cierre.
      const withConnections = httpServer as typeof httpServer & { closeAllConnections?: () => void };
      withConnections.closeAllConnections?.();
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
      if (mcpServer) await mcpServer.close();
    },
  };
}
