import { describe, expect, test } from "bun:test";
import { createJobInspectTool } from "../../src/modules/jobs/tools/job-inspect.tool";
import { createComponentDescribeTool } from "../../src/modules/component-definitions/tools/component-describe.tool";
import { createJobPlanTool, createJobEditTool } from "../../src/modules/jobs/tools/job-plan-edit.tool";
import { createJobRunTool, createRunStatusTool } from "../../src/modules/runs/tools/job-run.tool";
import { createCodeModeTools, setCodeModeRegistry } from "../../src/modules/jobs/tools/code-mode.tool";
import { getToolRisk } from "../../src/presentation/server/tool-safety";

describe("canónicas Fase 2 — existencia y riesgo", () => {
  test("las 9 canónicas existen con riesgo declarado", () => {
    const names = [
      "talend_job_inspect", "talend_component_describe", "talend_job_plan", "talend_job_edit",
      "talend_job_run", "talend_run_status", "talend_search", "talend_describe", "talend_execute",
    ];
    for (const name of names) {
      expect(["read", "write", "execute", "destructive"]).toContain(getToolRisk(name));
    }
    expect(getToolRisk("talend_job_inspect")).toBe("read");
    expect(getToolRisk("talend_job_edit")).toBe("write");
    expect(getToolRisk("talend_job_run")).toBe("execute");
  });

  test("tools exponen schema y descripción", () => {
    for (const factory of [createJobInspectTool, createComponentDescribeTool, createJobPlanTool, createJobEditTool, createJobRunTool, createRunStatusTool]) {
      const tool = factory();
      expect(tool.name.startsWith("talend_")).toBe(true);
      expect(tool.description.length).toBeGreaterThan(10);
      expect(tool.inputSchema).toBeDefined();
    }
  });
});

describe("Code Mode — solo operaciones registradas", () => {
  test("execute con operación no registrada es rechazada", async () => {
    const tools = createCodeModeTools() as unknown as Array<{ handler: (input: unknown) => Promise<unknown> }>;
    const execute = tools[2]!;
    setCodeModeRegistry(new Map([["talend_jobs_list", { description: "lista jobs", handler: async () => ({ ok: true }) }]]));
    const result = await execute.handler({ operation: "talend_no_existe", arguments: {} }) as any;
    expect(result.ok ?? result.error).toBeDefined();
    expect(result.ok).toBe(false);
  });

  test("describe de operación registrada devuelve descripción", async () => {
    const tools = createCodeModeTools() as unknown as Array<{ handler: (input: unknown) => Promise<unknown> }>;
    const describe = tools[1]!;
    setCodeModeRegistry(new Map([["talend_jobs_list", { description: "lista jobs", handler: async () => ({}) }]]));
    const result = await describe.handler({ operation: "talend_jobs_list" }) as any;
    expect(JSON.stringify(result)).toContain("lista jobs");
  });

  test("search encuentra por texto", async () => {
    const tools = createCodeModeTools() as unknown as Array<{ handler: (input: unknown) => Promise<unknown> }>;
    const search = tools[0]!;
    setCodeModeRegistry(new Map([["talend_jobs_list", { description: "lista jobs", handler: async () => ({}) }], ["talend_job_verify", { description: "verifica", handler: async () => ({}) }]]));
    const result = await search.handler({ query: "jobs" }) as any;
    expect(JSON.stringify(result)).toContain("talend_jobs_list");
  });
});
