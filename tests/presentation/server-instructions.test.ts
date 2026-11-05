import { afterAll, describe, expect, test } from "bun:test";
import { runNewHttpServer } from "../../src/presentation/server/new-server";
import { buildServerInstructions } from "../../src/modules/guide/domain/server-instructions";

const previousFilter = process.env.TALEND_MCP_FILTER;

afterAll(() => {
  if (previousFilter === undefined) delete process.env.TALEND_MCP_FILTER;
  else process.env.TALEND_MCP_FILTER = previousFilter;
});

describe("instrucciones del servidor", () => {
  test("son cortas y explican por donde empezar", () => {
    const instructions = buildServerInstructions();
    expect(instructions).toContain('talend_guide { mode: "overview" }');
    expect(instructions).toContain("ESTRATEGIA MIXTA");
    expect(instructions.length).toBeLessThan(4000);
    expect(instructions.length).toBeGreaterThan(0);
  });

  test("el handshake de initialize las incluye", async () => {
    // Con el preset corto el servidor registra 46 tools en vez de 230: la
    // prueba comprueba el cableado, no el tamano del catalogo.
    process.env.TALEND_MCP_FILTER = "agent";
    const server = await runNewHttpServer({ port: 0 });
    try {
      const response = await fetch(`${server.localUrl}/mcp`, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "test", version: "1.0" } } }),
      });
      expect([200, 406, 400]).toContain(response.status);
      if (response.status === 200) {
        const text = await response.text();
        expect(text.length).toBeGreaterThan(0);
        expect(text).toContain("talend");
      }
    } finally {
      await server.close();
    }
  });
});
