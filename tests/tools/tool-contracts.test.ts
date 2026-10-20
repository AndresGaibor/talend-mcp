import { test, expect, describe } from "bun:test";
import { convertInputSchema } from "../../src/server/adapt-tool";
import { createListJobsTool } from "../../src/presentation/tools/jobs/list-jobs.tool";
import { createReportSnippetsGenerateTool } from "../../src/modules/jobs/tools/report-snippets-generate.tool";
import { snapshotTools } from "../../src/talend/studio/tools-snapshot";

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
    const tool = createListJobsTool({} as never);
    const schema = convertInputSchema(tool.inputSchema) as JsonSchema;

    const required = getRequiredFields(schema);
    expect(required).not.toContain("limit");
    expect(required).not.toContain("offset");
    expect(getPropertyDefault(schema, "limit")).toBe(50);
    expect(getPropertyDefault(schema, "offset")).toBe(0);
  });

  test("talend_jobs_list acepta {} como input válido", () => {
    const tool = createListJobsTool({} as never);
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