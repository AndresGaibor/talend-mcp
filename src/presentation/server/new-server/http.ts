import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { NodeStreamableHTTPServerTransport } from "@modelcontextprotocol/node";
import { getRuntimeTools } from "../../../server/registered-tools";
import { handleEarlyRoute, PayloadTooLargeError, readBody } from "./http-routes";
import { createNewMcpServer } from "./common";
import type { NewServerHandle, NewServerOptions } from "./types";
import { getTalendMcpEnv } from "../../../config/env";

function isLoopbackHost(host: string): boolean {
  const normalized = host.trim().toLowerCase();
  return normalized === "127.0.0.1" || normalized === "localhost" || normalized === "::1" || normalized === "[::1]";
}

function hasValidToken(req: IncomingMessage, expected: string | undefined): boolean {
  if (!expected) return false;
  const header = req.headers.authorization;
  return header === `Bearer ${expected}`;
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

    if (!isLoopbackHost(host) && !hasValidToken(req, env.TALEND_MCP_TOKEN)) {
      res.writeHead(401, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "unauthorized" }));
      return;
    }

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
      // Tope de respuesta: se mide tras serializar, igual que el despacho
      // manual anterior. El SDK escribe al socket directamente, asi que no
      // se puede interceptar: se registra y se corta la sesion si excede.
      const timeout = setTimeout(() => { try { res.destroy(); } catch { /* noop */ } }, 100);
      const originalEnd = res.end.bind(res);
      (res as unknown as { _limited?: boolean })._limited = false;
      res.end = ((chunk?: unknown, encoding?: unknown, cb?: unknown) => {
        const text = typeof chunk === "string" ? chunk : JSON.stringify(chunk ?? "");
        const limit = options?.maxResponseBytes ?? env.TALEND_MCP_MAX_RESPONSE_BYTES;
        if (Buffer.byteLength(text, "utf8") > limit) {
          clearTimeout(timeout);
          res.writeHead(413, { "content-type": "application/json" });
          originalEnd(JSON.stringify({ ok: false, error: "response_too_large", maxBytes: limit }));
          return;
        }
        originalEnd(chunk as string, encoding as BufferEncoding, cb as () => void);
      }) as typeof res.end;
    }
    await transport.handleRequest(req, res, parsed);
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
