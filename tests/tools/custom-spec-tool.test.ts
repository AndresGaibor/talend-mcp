import { describe, expect, test } from "bun:test";
import { jobSpecTools } from "../../src/talend/studio/tools-job-spec";

describe("talend_job_apply_custom_spec", () => {
  const tool = jobSpecTools.find((candidate) => candidate.name === "talend_job_apply_custom_spec");

  test("acepta instrucciones del portal, nodos borrador y configuración estructurada", () => {
    expect(tool).toBeDefined();
    const parsed = tool!.inputSchema.safeParse({
      jobName: "job_daily",
      folderPath: "Process/PruebasWebSAS",
      components: [{
        uniqueName: "tMap_1",
        componentName: "tMap",
        label: "Transformar clientes",
        parameters: {},
        draftOnly: true,
        draftReason: "Falta el esquema de origen",
        tables: { LOOKUP: { columns: ["MATCHING_MODE"] } },
        mapper: { inputs: [], outputs: [] },
      }],
      instructions: {
        source: { program: "daily.sas", sha256: "abc123" },
        steps: [{ id: "step-1", operation: "append", evidence: { line: 12 } }],
        unresolved: ["schema"],
      },
    });
    expect(parsed.success).toBe(true);
  });

  test("acepta Jobs hijos con contextos vacíos en una propuesta de orquestador", () => {
    expect(tool).toBeDefined();
    const parsed = tool!.inputSchema.safeParse({
      jobName: "job_run_daily_insurance",
      folderPath: "Process/PruebasWebSAS/ts-sas-legacy-analytics/BatchJobs",
      components: [{
        uniqueName: "tRunJob_1",
        componentName: "tRunJob",
        label: "Ejecutar claims [op_109_macro_call_1]",
        parameters: { PROCESS: "job_claims_processing" },
      }],
      connections: [],
      contexts: [{ name: "CURR_DT", type: "id_String", value: "", comment: "Fecha pendiente" }],
      childJobs: [{
        jobName: "job_claims_processing",
        folderPath: "Process/PruebasWebSAS/ts-sas-legacy-analytics/Programs/Insurance",
        components: [],
        contexts: [{ name: "proc_date", type: "id_String", value: "", comment: "Fecha pendiente" }],
      }],
      instructions: { source: { program: "ts-sas-legacy-analytics/BatchJobs/run_daily_insurance.sas" } },
    });
    expect(parsed.success).toBe(true);
  });
});
