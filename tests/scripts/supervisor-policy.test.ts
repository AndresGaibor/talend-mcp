import { describe, expect, test } from "bun:test";
import { backoffMs, decideMcpAction, type HealthSample } from "../../scripts/lib/supervisor-policy";

const ok = (at: number): HealthSample => ({ mcpOk: true, bridgeOk: true, at });
const mcpDown = (at: number): HealthSample => ({ mcpOk: false, bridgeOk: true, at });

describe("backoffMs", () => {
  test("crece al doble y se detiene en 30 s", () => {
    expect([0, 1, 2, 3, 4, 5, 6, 10].map(backoffMs)).toEqual([1000, 2000, 4000, 8000, 16000, 30000, 30000, 30000]);
  });
});

describe("decideMcpAction", () => {
  test("sin muestras o con la ultima sana: no hace nada", () => {
    expect(decideMcpAction([])).toBe("none");
    expect(decideMcpAction([mcpDown(1), ok(2)])).toBe("none");
  });

  test("una o dos muestras caidas seguidas no reinician", () => {
    expect(decideMcpAction([ok(1), mcpDown(2), mcpDown(3)])).toBe("none");
  });

  test("tres muestras caidas seguidas reinician el MCP", () => {
    expect(decideMcpAction([ok(1), mcpDown(2), mcpDown(3), mcpDown(4)])).toBe("restart-mcp");
  });

  test("con el bridge caido tambien, el MCP es independiente de Studio", () => {
    const s: HealthSample[] = [1, 2, 3].map((at) => ({ mcpOk: false, bridgeOk: false, at }));
    expect(decideMcpAction(s)).toBe("restart-mcp");
  });
});
