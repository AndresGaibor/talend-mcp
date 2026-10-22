import { describe, expect, test } from "bun:test";
import { runNewHttpServer } from "../../src/presentation/server/new-server";

describe("Instrucciones para agentes en el handshake MCP", () => {
  test("initialize incluye el punto de entrada y las reglas de Talend", async () => {
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
      expect(payload.result?.instructions).toContain("talend_guide { mode: \"overview\" }");
      expect(payload.result?.instructions).toContain("nunca escribiendo el .item");
      expect(payload.result?.capabilities).toBeDefined();
    } finally {
      await server.close();
    }
  });
});
