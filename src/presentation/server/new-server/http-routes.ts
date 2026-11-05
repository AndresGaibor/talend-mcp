import type { IncomingMessage, ServerResponse } from "node:http";
import type { NodeStreamableHTTPServerTransport } from "@modelcontextprotocol/node";

export function createHealthPayload(toolCount: number) {
  return {
    ok: true,
    service: "talend-mcp",
    version: "1.0.0",
    toolCount,
  };
}

/**
 * Estado del proceso para vigilar fugas sin abrir Studio.
 *
 * `/healthz` solo dice "estoy vivo"; esto dice cuanto ocupa y cuantas
 * peticiones hay en vuelo, que es lo que hace falta para ver si la memoria
 * crece con el uso.
 */
export function createMetricsPayload(ctx: {
  toolCount: number;
  startedAt: number;
  maxBodyBytes: number;
  activeRequests: number;
}) {
  const memory = process.memoryUsage();
  return {
    ok: true,
    service: "talend-mcp",
    version: "1.0.0",
    pid: process.pid,
    node: process.version,
    uptimeSeconds: Math.round((Date.now() - ctx.startedAt) / 1000),
    toolCount: ctx.toolCount,
    activeRequests: ctx.activeRequests,
    maxBodyBytes: ctx.maxBodyBytes,
    memory: {
      rssBytes: memory.rss,
      heapTotalBytes: memory.heapTotal,
      heapUsedBytes: memory.heapUsed,
      externalBytes: memory.external,
      arrayBuffersBytes: memory.arrayBuffers,
    },
  };
}

function isLocalOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    if (url.protocol !== "http:") return false;
    const hostname = url.hostname.toLowerCase();
    return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1";
  } catch {
    return false;
  }
}

function isAllowedOrigin(origin: string | undefined, allowOrigins: string[] = []): boolean {
  if (!origin) return true;
  if (allowOrigins.includes("*")) return false;
  if (allowOrigins.includes(origin)) return true;
  return isLocalOrigin(origin);
}

export function validateHostHeader(hostHeader: string | undefined, bindHost: string): boolean {
  if (!hostHeader) return false;
  try {
    const url = new URL(`http://${hostHeader}`);
    const hostname = url.hostname.toLowerCase();
    return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1" || hostname === bindHost.toLowerCase();
  } catch {
    return false;
  }
}

// ─── Lectura del cuerpo HTTP ──────────────────────────────────────────────────

/** El cuerpo de la peticion supera el tope configurado. */
export class PayloadTooLargeError extends Error {
  constructor(readonly maxBytes: number) {
    super(`El cuerpo de la peticion excede ${maxBytes} bytes`);
    this.name = "PayloadTooLargeError";
  }
}

/**
 * Lee el cuerpo de la peticion con un tope duro.
 *
 * Sin tope, `body += chunk` acumula lo que mande el cliente: un POST grande
 * agota el heap del servidor antes de que JSON.parse pueda rechazarlo. Al
 * pasarse se corta la conexion y se lanza {@link PayloadTooLargeError}.
 */
export function readBody(req: IncomingMessage, maxBytes = 1_048_576): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    let bytes = 0;
    let exceeded = false;
    req.setEncoding("utf8");
    req.on("data", (chunk: string) => {
      if (exceeded) return; // Se descarta el resto: la memoria ya no crece.
      bytes += Buffer.byteLength(chunk, "utf8");
      if (bytes > maxBytes) {
        exceeded = true;
        body = "";
        return;
      }
      body += chunk;
    });
    // Se espera al final del cuerpo para poder responder 413 sin cortar el socket
    // a mitad: destruirlo antes provoca ECONNRESET en el cliente.
    req.on("end", () => (exceeded ? reject(new PayloadTooLargeError(maxBytes)) : resolve(body)));
    req.on("error", reject);
  });
}

// ─── Rutas previas al despacho JSON-RPC ───────────────────────────────────────

export interface EarlyRouteContext {
  host: string;
  port: number;
  path: string;
  toolCount: number;
  startedAt: number;
  maxBodyBytes: number;
  activeRequests: () => number;
  streamingTransport: () => Promise<NodeStreamableHTTPServerTransport>;
}

/**
 * Atiende preflight CORS, health, ruta desconocida, origen no permitido y GET.
 * Devuelve true cuando ya respondio; el llamador sigue con el POST.
 */
export async function handleEarlyRoute(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: EarlyRouteContext,
): Promise<boolean> {
  const requestUrl = new URL(req.url ?? "/", `http://${req.headers.host ?? `${ctx.host}:${ctx.port}`}`);

  // ── CORS preflight ──
  if (req.method === "OPTIONS") {
    const origin = req.headers.origin;
    if (origin !== undefined && !isAllowedOrigin(origin, [])) {
      res.writeHead(403, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "origin_denied" }));
      return true;
    }
    res.writeHead(204, {
      "access-control-allow-origin": origin ?? "",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "content-type, accept, authorization",
      "access-control-max-age": "86400",
    });
    res.end();
    return true;
  }

  // ── Health endpoint ──
  if (requestUrl.pathname === "/healthz") {
    const payload = createHealthPayload(ctx.toolCount);
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(payload));
    return true;
  }

  // ── Metrics endpoint ──
  if (requestUrl.pathname === "/metrics") {
    const payload = createMetricsPayload({
      toolCount: ctx.toolCount,
      startedAt: ctx.startedAt,
      maxBodyBytes: ctx.maxBodyBytes,
      activeRequests: ctx.activeRequests(),
    });
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(payload));
    return true;
  }

  if (requestUrl.pathname !== ctx.path) {
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: "not_found" }));
    return true;
  }

  const origin = req.headers.origin;
  if (origin !== undefined && !isAllowedOrigin(origin, [])) {
    res.writeHead(403, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: "origin_denied" }));
    return true;
  }

  if (!validateHostHeader(req.headers.host, ctx.host)) {
    res.writeHead(403, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: "host_denied" }));
    return true;
  }

  const accept = req.headers.accept ?? "";

  // ── GET /mcp with SSE → delegate to streaming transport (Claude Desktop etc.) ──
  if (req.method === "GET") {
    if (accept.includes("text/event-stream")) {
      await (await ctx.streamingTransport()).handleRequest(req, res);
    } else {
      const payload = createHealthPayload(ctx.toolCount);
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(payload));
    }
    return true;
  }

  // POST sin initialize es invalido para Streamable HTTP: el SDK responde 400
  // sin sesion inicializada. Se deja que el SDK decida (406/400) para que el
  // cliente use el handshake correcto.
  // Compatibilidad: los tests historicos llaman tools/call directo sin
  // initialize; se acepta y se encamina al SDK, que responde 406 si falta la
  // sesion. Para clientes de produccion eso es el comportamiento correcto
  // del protocolo Streamable HTTP.
  return false;
}
