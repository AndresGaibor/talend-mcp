import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { NodeStreamableHTTPServerTransport } from "@modelcontextprotocol/node";
import { getRuntimeTools } from "../../../server/registered-tools";
import { handleEarlyRoute, PayloadTooLargeError, readBody } from "./http-routes";
import { createNewMcpServer } from "./common";
import { aplicarTopeDeRespuesta } from "./response-limit";
import type { NewServerHandle, NewServerOptions } from "./types";
import { getTalendMcpEnv } from "../../../config/env";
import { withRequestMetadata } from "./request-context";

function isLoopbackHost(host: string): boolean {
  const normalized = host.trim().toLowerCase();
  return normalized === "127.0.0.1" || normalized === "localhost" || normalized === "::1" || normalized === "[::1]";
}

function hasValidToken(req: IncomingMessage, expected: string | undefined): boolean {
  if (!expected) return false;
  const header = req.headers.authorization;
  return header === `Bearer ${expected}`;
}

/** Las rutas de diagnóstico también quedan protegidas al escuchar fuera de loopback. */
export function requiresRequestAuthentication(host: string, method: string, pathname: string): boolean {
  return !isLoopbackHost(host) && method !== "OPTIONS" && pathname !== "/healthz";
}

export async function runNewHttpServer(options?: NewServerOptions): Promise<NewServerHandle> {
  const host = options?.host ?? "127.0.0.1";
  const port = options?.port ?? 3927;
  const env = getTalendMcpEnv();
  const maxBodyBytes = options?.maxBodyBytes ?? env.TALEND_MCP_MAX_BODY_BYTES;
  const path = "/mcp";

  if (!isLoopbackHost(host) && !env.TALEND_MCP_TOKEN) {
    throw new Error(`TALEND_MCP_HOST=${host} no es loopback y falta TALEND_MCP_TOKEN: el servidor no arranca sin autenticacion.`);
  }

  const runtimeTools = getRuntimeTools();

  let mcpServer: ReturnType<typeof createNewMcpServer> | null = null;
  let activeRequests = 0;
  const startedAt = Date.now();

  async function streamingTransport(): Promise<NodeStreamableHTTPServerTransport> {
    if (!mcpServer) {
      mcpServer = createNewMcpServer();
    }
    return new NodeStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  }

  const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    activeRequests++;
    res.once("close", () => { activeRequests--; });

    const requestUrl = new URL(req.url ?? "/", `http://${req.headers.host ?? `${host}:${port}`}`);
    if (requiresRequestAuthentication(host, req.method ?? "GET", requestUrl.pathname)
      && !hasValidToken(req, env.TALEND_MCP_TOKEN)) {
      res.writeHead(401, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "unauthorized" }));
      return;
    }

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

    if (req.method !== "POST") {
      res.writeHead(405, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "method_not_allowed" }));
      return;
    }

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

    const transport = await streamingTransport();
    if (!mcpServer) {
      mcpServer = createNewMcpServer();
    }
    await mcpServer.connect(transport);
    const parsed = JSON.parse(body) as Record<string, unknown>;
    if (parsed.method === "tools/call") {
      // El SDK escribe la respuesta en streaming, asi que el tope se aplica a
      // `write` y `end` (no solo al final). Si la respuesta no cabe, se
      // descarta y se devuelve un error JSON-RPC con la tool y el tope.
      const timeout = setTimeout(
        () => { try { res.destroy(); } catch { /* noop */ } },
        options?.toolTimeoutMs ?? env.TALEND_MCP_TOOL_TIMEOUT_MS,
      );
      res.once("close", () => clearTimeout(timeout));
      const params = (parsed.params ?? {}) as { name?: unknown };
      aplicarTopeDeRespuesta(res, {
        maxBytes: options?.maxResponseBytes ?? env.TALEND_MCP_MAX_RESPONSE_BYTES,
        tool: typeof params.name === "string" ? params.name : "la tool",
        id: parsed.id,
      });
    }
    const rawIdempotencyKey = req.headers["idempotency-key"];
    const idempotencyKey = typeof rawIdempotencyKey === "string" ? rawIdempotencyKey : undefined;
    await withRequestMetadata({ idempotencyKey }, () => transport.handleRequest(req, res, parsed));
  });

  const listenPort = await new Promise<number>((resolve, reject) => {
    const listen = (p: number): void => {
      const onError = (error: NodeJS.ErrnoException): void => {
        httpServer.off("error", onError);
        if (error.code === "EADDRINUSE" && p !== 0) {
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
      const withConnections = httpServer as typeof httpServer & { closeAllConnections?: () => void };
      withConnections.closeAllConnections?.();
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
      if (mcpServer) await mcpServer.close();
    },
  };
}
