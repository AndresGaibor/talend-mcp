import { describe, expect, test } from "bun:test";
import { createTalendMcpServer } from "../../src/server";

describe("MCP server", () => {
  test("crea servidor MCP", () => {
    const server = createTalendMcpServer();
    expect(server).toBeDefined();
  });

  test("registra tools de inspeccion", () => {
    const server = createTalendMcpServer();
    const toolNames = Object.keys((server as unknown as { _registeredTools: Record<string, unknown> })._registeredTools);
    expect(toolNames).toContain("talend_inspect_component");
    expect(toolNames).toContain("talend_inspect_job");
    expect(toolNames).toContain("talend_update_analysis");
    expect(toolNames).toContain("talend_duplicate_analysis");
  });
});
