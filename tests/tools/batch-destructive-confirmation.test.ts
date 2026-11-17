import { afterEach, describe, expect, test } from "bun:test";

import { createJobsCreateBatchTool, createJobsEditBatchTool } from "../../src/presentation/tools/jobs/batch.tool";
import { authorizeTool } from "../../src/presentation/server/tool-auth";
import { validateInput } from "../../src/presentation/server/new-server/dispatch";

const previousAllow = process.env.TALEND_MCP_ALLOW_DESTRUCTIVE;

afterEach(() => {
  if (previousAllow === undefined) delete process.env.TALEND_MCP_ALLOW_DESTRUCTIVE;
  else process.env.TALEND_MCP_ALLOW_DESTRUCTIVE = previousAllow;
});

describe("confirmación de operaciones por lotes", () => {
  test("la creación del lote acepta confirm y el dispatcher la puede autorizar", () => {
    process.env.TALEND_MCP_ALLOW_DESTRUCTIVE = "1";
    const tool = createJobsCreateBatchTool();
    const input = validateInput(tool.inputSchema, {
      confirm: true,
      template: { jobName: "MCP_TEST_{{id}}", components: [] },
      rows: [{ id: "01" }],
    });

    expect(authorizeTool(tool.name, input)).toEqual({ ok: true });
  });

  test("la edición del lote acepta confirm sin relajar el gate destructivo", () => {
    const tool = createJobsEditBatchTool();
    const input = validateInput(tool.inputSchema, {
      confirm: true,
      jobs: ["MCP_TEST"],
      operations: [{ op: "move", uniqueName: "node_1", posX: 1, posY: 1 }],
    });

    expect(authorizeTool(tool.name, input).ok).toBe(false);
    process.env.TALEND_MCP_ALLOW_DESTRUCTIVE = "1";
    expect(authorizeTool(tool.name, input)).toEqual({ ok: true });
  });
});
