import { test, expect, describe } from "bun:test";
import { convertInputSchema } from "../../src/server/adapt-tool";
import { createListJobsTool } from "../../src/presentation/tools/jobs/list-jobs.tool";
import { createReportSnippetsGenerateTool } from "../../src/modules/jobs/tools/report-snippets-generate.tool";
import { snapshotTools } from "../../src/talend/studio/tools-snapshot";
import { getEnrichedOutputSchema, hasEnrichedDataSchema, TalendColumnSchema } from "../../src/server/enriched-schemas";

type JsonSchema = {
  type?: string;
  properties?: Record<string, unknown>;
  required?: string[];
  default?: unknown;
};

function getRequiredFields(schema: unknown): string[] {
  const s = schema as JsonSchema;
  if (s?.type === "object" && Array.isArray(s.required)) {
    return s.required;
  }
  return [];
}

function getPropertyDefault(schema: unknown, field: string): unknown {
  const s = schema as JsonSchema;
  const prop = s?.properties?.[field] as JsonSchema | undefined;
  return prop?.default;
}

describe("Tool Contracts — campos con default no son required", () => {
  test("talend_jobs_list: limit y offset tienen default y no deben ser required", () => {
    const tool = createListJobsTool();
    const schema = convertInputSchema(tool.inputSchema) as JsonSchema;

    const required = getRequiredFields(schema);
    expect(required).not.toContain("limit");
    expect(required).not.toContain("offset");
    expect(getPropertyDefault(schema, "limit")).toBe(50);
    expect(getPropertyDefault(schema, "offset")).toBe(0);
  });

  test("talend_jobs_list acepta {} como input válido", () => {
    const tool = createListJobsTool();
    const schema = convertInputSchema(tool.inputSchema);
    const required = getRequiredFields(schema);

    const emptyInput: Record<string, unknown> = {};
    for (const field of required) {
      expect(emptyInput).not.toHaveProperty(field);
    }
  });

  test("talend_snapshots_list: limit y offset tienen default y no deben ser required", () => {
    const tool = snapshotTools.find((t) => t.name === "talend_snapshots_list")!;
    const schema = convertInputSchema(tool.inputSchema) as JsonSchema;

    const required = getRequiredFields(schema);
    expect(required).not.toContain("limit");
    expect(required).not.toContain("offset");
    expect(getPropertyDefault(schema, "limit")).toBe(50);
    expect(getPropertyDefault(schema, "offset")).toBe(0);
  });

  test("talend_snapshots_list acepta {} como input válido", () => {
    const tool = snapshotTools.find((t) => t.name === "talend_snapshots_list")!;
    const schema = convertInputSchema(tool.inputSchema);
    const required = getRequiredFields(schema);

    const emptyInput: Record<string, unknown> = {};
    for (const field of required) {
      expect(emptyInput).not.toHaveProperty(field);
    }
  });

  test("talend_report_snippets_generate: mode tiene default 'single' y no debe ser required", () => {
    const tool = createReportSnippetsGenerateTool();
    const schema = convertInputSchema(tool.inputSchema) as JsonSchema;

    const required = getRequiredFields(schema);
    expect(required).not.toContain("mode");
    expect(getPropertyDefault(schema, "mode")).toBe("single");
  });

  test("talend_report_snippets_generate acepta { section, jobName } sin mode", () => {
    const tool = createReportSnippetsGenerateTool();
    const schema = convertInputSchema(tool.inputSchema);
    const required = getRequiredFields(schema);

    const minimalInput = { section: "diseno", jobName: "MiJob" };
    for (const field of required) {
      expect(minimalInput).toHaveProperty(field);
    }
    expect(required).not.toContain("mode");
 });

});

describe("schemas de salida enriquecidos por dominio", () => {
  test("conserva los schemas de jobs y componentes en la fachada", () => {
    expect(hasEnrichedDataSchema("talend_delete_job")).toBe(true);
    expect(hasEnrichedDataSchema("talend_update_schema_column")).toBe(true);
    expect(TalendColumnSchema.safeParse({ name: "id", type: "id_Integer" }).success).toBe(true);

    const deleteOutput = getEnrichedOutputSchema("talend_delete_job");
    expect(deleteOutput.safeParse({ ok: true, data: { deleted: true, jobName: "ventas" } }).success).toBe(true);

    const updateOutput = getEnrichedOutputSchema("talend_update_schema_column");
    expect(updateOutput.safeParse({
      ok: true,
      data: { itemPath: "job.item", uniqueName: "tInput_1", columnName: "id", column: {} },
    }).success).toBe(true);
  });

  test("conserva los schemas de ejecucion y Studio en la fachada", () => {
    expect(hasEnrichedDataSchema("talend_find_exported_jobs")).toBe(true);
    expect(getEnrichedOutputSchema("talend_find_exported_jobs").safeParse({
      ok: true,
      data: [{ jobName: "Ventas", scriptPath: "Ventas_run.sh", platform: "posix", folderPath: "build", modifiedAt: "" }],
    }).success).toBe(true);
    expect(getEnrichedOutputSchema("talend_live_status").safeParse({
      ok: true,
      data: { active: false, warnings: [] },
    }).success).toBe(true);
  });

  test("conserva los schemas de contextos y repositorio en la fachada", () => {
    // El bridge devuelve el item completo: versión, entornos y sus variables.
    expect(getEnrichedOutputSchema("talend_list_repository_contexts").safeParse({
      ok: true,
      data: {
        contexts: [{
          name: "produccion",
          version: "0.1",
          defaultContext: "Datasets",
          contexts: [{ name: "Datasets", parameters: [{ name: "db_host", type: "id_String", value: "10.0.0.1" }] }],
        }],
      },
    }).success).toBe(true);
    // La forma plana antigua sigue siendo válida para no romper consumidores.
    expect(getEnrichedOutputSchema("talend_list_repository_contexts").safeParse({
      ok: true,
      data: { contexts: [{ name: "Default", parameters: [] }] },
    }).success).toBe(true);
    expect(getEnrichedOutputSchema("talend_read_repository_context").safeParse({
      ok: true,
      data: { context: { name: "prueba_4", version: "0.1", contexts: [] } },
    }).success).toBe(true);
    expect(getEnrichedOutputSchema("talend_list_repository_connections").safeParse({
      ok: true,
      data: {
        count: 1,
        connections: [{
          name: "Shared connection",
          version: "0.1",
          itemType: "DatabaseConnectionItemImpl",
          connectionType: "PostgreSQL",
        }],
      },
    }).success).toBe(true);
    expect(getEnrichedOutputSchema("talend_repo_status").safeParse({
      ok: true,
      data: {
        branch: "main",
        lastCommit: "abc1234 mensaje",
        hasRemote: true,
        project: { projectName: "repo", jobCount: 0, hasMetadata: false },
      },
    }).success).toBe(true);
  });

  test("conserva los schemas de análisis y módulos en la fachada", () => {
    expect(getEnrichedOutputSchema("talend_analyze_logs").safeParse({
      ok: true,
      data: { logFile: null, analysis: null, rawSnippet: [], suggestions: [] },
    }).success).toBe(true);
    expect(getEnrichedOutputSchema("talend_secrets_scan_job").safeParse({
      ok: true,
      data: { jobName: "Ventas", secretsFoundCount: 0, findings: [] },
    }).success).toBe(true);
    expect(getEnrichedOutputSchema("talend_datasets_inspect_csv_folder").safeParse({
      ok: true,
      data: { folderPath: "data", files: [], totalRows: 0 },
    }).success).toBe(true);
    expect(getEnrichedOutputSchema("talend_deliverables_validate").safeParse({
      ok: true,
      data: { valid: true, errors: [], warnings: [] },
    }).success).toBe(true);
  });
});
