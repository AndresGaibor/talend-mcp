import { describe, expect, test } from "bun:test";
import { createTalendMcpServer } from "../../src/presentation/server/new-server";

describe("MCP server", () => {
  test("crea servidor MCP", () => {
    const server = createTalendMcpServer() as unknown as {
      _registeredTools: Record<string, {
        inputSchema: { "~standard"?: { jsonSchema?: { input?: unknown } } };
        outputSchema: { "~standard"?: { jsonSchema?: { input?: unknown } } };
      }>;
    };
    expect(server).toBeDefined();
    expect(Object.values(server._registeredTools).every((tool) =>
      typeof tool.inputSchema["~standard"]?.jsonSchema?.input === "function" &&
      typeof tool.outputSchema["~standard"]?.jsonSchema?.input === "function",
    )).toBe(true);
  });

  test("registra tools de inspeccion", () => {
    const server = createTalendMcpServer();
    const toolNames = Object.keys((server as unknown as { _registeredTools: Record<string, unknown> })._registeredTools);
    expect(toolNames).toContain("talend_inspect_component");
    expect(toolNames).toContain("talend_inspect_job");
    expect(toolNames).toContain("talend_list_project_contexts");
    expect(toolNames).toContain("talend_update_analysis");
    expect(toolNames).toContain("talend_duplicate_analysis");
  });
});

