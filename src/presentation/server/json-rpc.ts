import type { ServerResponse } from "node:http";

import { buildServerInstructions } from "../../modules/guide/domain/server-instructions";

/**
 * Respuestas JSON-RPC del servidor MCP por HTTP.
 *
 * La mayoria de los clientes solo necesita `initialize`, `tools/list` y
 * `tools/call`; se responden como JSON normal, sin abrir un stream SSE. El
 * transporte SSE se reserva para quien lo pide explicitamente.
 */

export function jsonRpcOk(id: unknown, result: unknown) {
  return { jsonrpc: "2.0", id: id ?? null, result };
}

export function jsonRpcError(id: unknown, code: number, message: string) {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message } };
}

export function sendJson(res: ServerResponse, origin: string | undefined, payload: unknown) {
  sendJsonText(res, origin, JSON.stringify(payload));
}

export function sendJsonText(res: ServerResponse, origin: string | undefined, json: string) {
  res.writeHead(200, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(json),
    "access-control-allow-origin": origin ?? "*",
    "connection": "close",
  });
  res.end(json);
}

export function sendAccepted(res: ServerResponse, origin: string | undefined) {
  res.writeHead(202, {
    "content-type": "application/json",
    "access-control-allow-origin": origin ?? "*",
    "connection": "close",
  });
  res.end("{}");
}

export function buildServerCapabilities() {
  return {
    tools: { listChanged: false },
    resources: { listChanged: false },
    prompts: { listChanged: false },
  };
}

/**
 * Atiende los metodos que no necesitan el registro de tools.
 *
 * Devuelve `false` para `tools/call`, que el servidor HTTP resuelve aparte con
 * el handler de la tool.
 */
export function handleMcpRequest(
  parsed: { jsonrpc?: string; id?: unknown; method?: string; params?: unknown },
  origin: string | undefined,
  res: ServerResponse,
  toolsJson: string,
): boolean {
  const { id, method } = parsed;

  if (method === "initialize") {
    sendJson(res, origin, jsonRpcOk(id, {
      protocolVersion: "2024-11-05",
      serverInfo: { name: "talend-mcp", version: "1.0.0" },
      capabilities: buildServerCapabilities(),
      instructions: buildServerInstructions(),
    }));
    return true;
  }

  if (method === "notifications/initialized" || method === "ping") {
    // Las notificaciones no llevan id: solo se acusan.
    sendAccepted(res, origin);
    return true;
  }

  if (method === "tools/list") {
    sendJsonText(res, origin, `{"jsonrpc":"2.0","id":${JSON.stringify(id ?? null)},"result":{"tools":${toolsJson}}}`);
    return true;
  }

  if (method === "tools/call") return false;

  if (method === "resources/list") {
    sendJson(res, origin, jsonRpcOk(id, { resources: [] }));
    return true;
  }

  if (method === "prompts/list") {
    sendJson(res, origin, jsonRpcOk(id, { prompts: [] }));
    return true;
  }

  sendJson(res, origin, jsonRpcError(id, -32601, `Method not found: ${method}`));
  return true;
}
