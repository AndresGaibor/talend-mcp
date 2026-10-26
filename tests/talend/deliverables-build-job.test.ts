import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { deliverableTools } from "../../src/talend/studio/tools-deliverables";

const TOOL_NAME = "talend_deliverables_build_job";

type BuildJobTool = {
  name: string;
  annotations?: { readOnly?: boolean };
  inputSchema: { parse: (input: unknown) => { contextName: string; version: string; destinationDir?: string } };
  handler: (input: { jobName: string; destinationDir?: string }) => Promise<{ isError?: boolean; structuredContent?: unknown }>;
};

function buildJobTool(): BuildJobTool {
  const tool = deliverableTools.find((t) => t.name === TOOL_NAME);
  if (!tool) throw new Error(`falta la tool ${TOOL_NAME}`);
  return tool as unknown as BuildJobTool;
}

describe("talend_deliverables_build_job", () => {
  let antes: string | undefined;

  beforeEach(() => {
    antes = process.env.TALEND_BUILDS_DIR;
    delete process.env.TALEND_BUILDS_DIR;
  });

  afterEach(() => {
    if (antes === undefined) delete process.env.TALEND_BUILDS_DIR;
    else process.env.TALEND_BUILDS_DIR = antes;
  });

  it("aplica el contexto Default y la version 0.1 si no se indican", () => {
    const parsed = buildJobTool().inputSchema.parse({ jobName: "MCP_Ejemplo" });
    expect(parsed.contextName).toBe("Default");
    expect(parsed.version).toBe("0.1");
    expect(parsed.destinationDir).toBeUndefined();
  });

  it("falla con NO_BUILDS_DIR sin destinationDir ni TALEND_BUILDS_DIR, sin llamar al bridge", async () => {
    const result = await buildJobTool().handler({ jobName: "MCP_Ejemplo" });
    expect(result.isError).toBe(true);
    const payload = result.structuredContent as { ok: boolean; error: { code: string; message: string } };
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("NO_BUILDS_DIR");
    expect(payload.error.message).toContain("TALEND_BUILDS_DIR");
  });

  it("la tool se publica como entregable (prefijo talend_deliverables_) y no es de solo lectura", () => {
    const tool = buildJobTool();
    expect(tool.name.startsWith("talend_deliverables_")).toBe(true);
    expect((tool as { annotations?: { readOnly?: boolean } }).annotations?.readOnly).toBe(false);
  });
});
