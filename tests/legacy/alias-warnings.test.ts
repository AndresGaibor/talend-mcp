import { test, expect, describe } from "bun:test";
import { createLegacyAliasTool } from "../../src/modules/legacy/create-legacy-alias-tool";

describe("createLegacyAliasTool", () => {
  test("adds warning to TalendToolResult", async () => {
    const mockCanonical = {
      definition: { 
        name: "talend_jobs_list", 
        description: "desc", 
        inputSchema: {},
        outputSchema: {} 
      },
      handler: async () => ({
        ok: true,
        source: "talend",
        confidence: "high",
        data: { jobs: [] }
      })
    } as any;

    const legacyTool = createLegacyAliasTool("talend_list_jobs", mockCanonical);
    const result = await legacyTool.handler({});

    expect(result).toMatchObject({
      ok: true,
      warnings: ["Warning: talend_list_jobs is legacy. Use talend_jobs_list instead."]
    });
  });

  test("adds warning to MCP CallToolResult", async () => {
    const mockCanonical = {
      definition: { 
        name: "talend_jobs_list", 
        description: "desc", 
        inputSchema: {},
        outputSchema: {} 
      },
      handler: async () => ({
        content: [{ type: "text", text: "result" }]
      })
    } as any;

    const legacyTool = createLegacyAliasTool("talend_list_jobs", mockCanonical);
    const result = await legacyTool.handler({});

    expect((result as any).content).toHaveLength(2);
    expect((result as any).content[1].text).toContain("Warning: talend_list_jobs is legacy");
  });

  test("adds warning to generic object result", async () => {
    const mockCanonical = {
      definition: { 
        name: "talend_jobs_list", 
        description: "desc", 
        inputSchema: {},
        outputSchema: {} 
      },
      handler: async () => ({
        someData: "here"
      })
    } as any;

    const legacyTool = createLegacyAliasTool("talend_list_jobs", mockCanonical);
    const result = await legacyTool.handler({});

    expect(result).toMatchObject({
      someData: "here",
      warning: "Warning: talend_list_jobs is legacy. Use talend_jobs_list instead."
    });
  });

  test("does not add duplicate warnings", async () => {
    const mockCanonical = {
      definition: { 
        name: "talend_jobs_list", 
        description: "desc", 
        inputSchema: {},
        outputSchema: {} 
      },
      handler: async () => ({
        ok: true,
        warnings: ["Warning: talend_list_jobs is legacy. Use talend_jobs_list instead."]
      })
    } as any;

    const legacyTool = createLegacyAliasTool("talend_list_jobs", mockCanonical);
    const result = await legacyTool.handler({});

    expect((result as any).warnings).toHaveLength(1);
  });
});
