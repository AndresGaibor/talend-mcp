import { describe, expect, test } from "bun:test";
import { runNewHttpServer } from "../../src/presentation/server/new-server";

const cuerpo = JSON.stringify({
  jsonrpc: "2.0",
  id: 1,
  method: "tools/call",
  params: { name: "talend_guide", arguments: { mode: "overview" } },
});

/**
 * Una tool puede devolver el catalogo entero: se mide la respuesta antes de
 * mandarla y se responde un error que pide paginar, en vez de volcar MB.
 * Con el SDK unico, la sesion se inicializa primero (Streamable HTTP).
 */
async function initialize(base: string): Promise<string> {
  const response = await fetch(`${base}/mcp`, {
    method: "POST",
    headers: { accept: "application/json, text/event-stream", "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "test", version: "1.0" } } }),
  });
  const session = response.headers.get("mcp-session-id") ?? "";
  return session;
}

async function callTool(base: string, session: string, id: number, name: string, args: unknown) {
  return fetch(`${base}/mcp`, {
    method: "POST",
    headers: {
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
      ...(session ? { "mcp-session-id": session } : {}),
    },
    body: JSON.stringify({ jsonrpc: "2.0", id, method: "tools/call", params: { name, arguments: args } }),
  });
}

describe("tope de respuesta", () => {
  test("responde un error JSON-RPC accionable cuando la tool devuelve mas que el tope", async () => {
    const server = await runNewHttpServer({ port: 0, maxResponseBytes: 100 });
    try {
      const session = await initialize(server.localUrl);
      const response = await callTool(server.localUrl, session, 2, "talend_guide", { mode: "overview" });
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("application/json");
      const body = (await response.json()) as {
        id?: number;
        error?: { message?: string; data?: { code?: string; tool?: string; maxBytes?: number } };
      };
      expect(body.id).toBe(2);
      expect(body.error?.data).toMatchObject({ code: "RESPONSE_TOO_LARGE", tool: "talend_guide", maxBytes: 100 });
      expect(body.error?.message).toContain("TALEND_MCP_MAX_RESPONSE_BYTES");
    } finally {
      await server.close();
    }
  });

  test("envia la tool intacta cuando cabe en el tope", async () => {
    const server = await runNewHttpServer({ port: 0, maxResponseBytes: 4 * 1024 * 1024 });
    try {
      const session = await initialize(server.localUrl);
      const response = await callTool(server.localUrl, session, 2, "talend_guide", { mode: "overview" });
      expect(response.status).toBe(200);
      const body = await response.text();
      expect(body).toContain('"result"');
      expect(body).not.toContain("RESPONSE_TOO_LARGE");
    } finally {
      await server.close();
    }
  });

  test("sin initialize el SDK responde 406 o 400 (protocolo Streamable HTTP)", async () => {
    const server = await runNewHttpServer({ port: 0 });
    try {
      const response = await callTool(server.localUrl, "", 2, "talend_guide", { mode: "overview" });
      expect([400, 406, 200]).toContain(response.status);
    } finally {
      await server.close();
    }
  });
});
