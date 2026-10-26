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

function isLocalOrigin(origin: string): boolean {
  return origin.startsWith("http://127.0.0.1:") || origin.startsWith("http://localhost:");
}

function isAllowedOrigin(origin: string | undefined, allowOrigins: string[] = []): boolean {
  if (!origin) return true;
  if (allowOrigins.includes("*")) return true;
  if (allowOrigins.includes(origin)) return true;
  return isLocalOrigin(origin);
}

// ─── Lectura del cuerpo HTTP ──────────────────────────────────────────────────

export function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk: string) => { body += chunk; });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

// ─── Rutas previas al despacho JSON-RPC ───────────────────────────────────────

export interface EarlyRouteContext {
  host: string;
  port: number;
  path: string;
  toolCount: number;
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
    res.writeHead(204, {
      "access-control-allow-origin": req.headers.origin ?? "*",
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

  if (requestUrl.pathname !== ctx.path) {
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: "not_found" }));
    return true;
  }

  const origin = req.headers.origin;
  if (!isAllowedOrigin(origin, [])) {
    res.writeHead(403, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: "origin_denied" }));
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

  return false;
}
