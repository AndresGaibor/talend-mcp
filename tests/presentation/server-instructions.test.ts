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
  });

  test("el handshake de initialize las incluye", async () => {
    // Con el preset corto el servidor registra 46 tools en vez de 230: la
    // prueba comprueba el cableado, no el tamano del catalogo.
    process.env.TALEND_MCP_FILTER = "agent";
    const server = await runNewHttpServer({ port: 0 });
    try {
      const response = await fetch(`${server.localUrl}/mcp`, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }),
      });
      const payload = (await response.json()) as {
        result?: { instructions?: string; capabilities?: unknown };
      };

      expect(response.ok).toBe(true);
      expect(payload.result?.instructions).toBe(buildServerInstructions());
      expect(payload.result?.capabilities).toBeDefined();
    } finally {
      await server.close();
    }
  });
});
