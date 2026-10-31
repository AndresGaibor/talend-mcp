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
 */
describe("tope de respuesta", () => {
  test("responde error cuando la tool devuelve mas que el tope", async () => {
    const server = await runNewHttpServer({ port: 0, maxResponseBytes: 100 });
    try {
      const response = await fetch(`${server.localUrl}/mcp`, {
        method: "POST",
        headers: { accept: "application/json", "content-type": "application/json" },
        body: cuerpo,
      });
      expect(response.status).toBe(200);
      const payload = await response.json() as { error?: { code?: number; message?: string } };
      expect(payload.error?.code).toBe(-32000);
      expect(payload.error?.message).toContain("tope es 100");
    } finally {
      await server.close();
    }
  });

  test("responde la tool cuando cabe en el tope", async () => {
    const server = await runNewHttpServer({ port: 0, maxResponseBytes: 4 * 1024 * 1024 });
    try {
      const response = await fetch(`${server.localUrl}/mcp`, {
        method: "POST",
        headers: { accept: "application/json", "content-type": "application/json" },
        body: cuerpo,
      });
      expect(response.status).toBe(200);
      const payload = await response.json() as { result?: { content?: unknown[] }; error?: unknown };
      expect(payload.error).toBeUndefined();
      expect(Array.isArray(payload.result?.content)).toBe(true);
    } finally {
      await server.close();
    }
  });
});
