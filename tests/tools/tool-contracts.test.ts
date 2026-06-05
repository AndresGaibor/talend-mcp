import { test, expect, describe } from "bun:test";
import { convertInputSchema } from "../../src/server/adapt-tool";
import { createJobsListTool } from "../../src/modules/jobs/tools/jobs-list.tool";
import { createSnapshotsListTool } from "../../src/modules/snapshots/tools/snapshots-list.tool";
import { createReportSnippetsGenerateTool } from "../../src/modules/jobs/tools/report-snippets-generate.tool";
import { createAppSessionCreateTool } from "../../src/modules/apps/session/tools/app-session-create.tool";
import { createAppSessionGetTool } from "../../src/modules/apps/session/tools/app-session-get.tool";

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
    const tool = createJobsListTool();
    const schema = convertInputSchema(tool.inputSchema) as JsonSchema;

    const required = getRequiredFields(schema);
    expect(required).not.toContain("limit");
    expect(required).not.toContain("offset");
    expect(getPropertyDefault(schema, "limit")).toBe(50);
    expect(getPropertyDefault(schema, "offset")).toBe(0);
  });

  test("talend_jobs_list acepta {} como input válido", () => {
    const tool = createJobsListTool();
    const schema = convertInputSchema(tool.inputSchema);
    const required = getRequiredFields(schema);

    const emptyInput: Record<string, unknown> = {};
    for (const field of required) {
      expect(emptyInput).not.toHaveProperty(field);
    }
  });

  test("talend_snapshots_list: limit y offset tienen default y no deben ser required", () => {
    const tool = createSnapshotsListTool();
    const schema = convertInputSchema(tool.inputSchema) as JsonSchema;

    const required = getRequiredFields(schema);
    expect(required).not.toContain("limit");
    expect(required).not.toContain("offset");
    expect(getPropertyDefault(schema, "limit")).toBe(50);
    expect(getPropertyDefault(schema, "offset")).toBe(0);
  });

  test("talend_snapshots_list acepta {} como input válido", () => {
    const tool = createSnapshotsListTool();
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

  test("talend_app_session_create: id tiene default 'default' y no debe ser required", () => {
    const tool = createAppSessionCreateTool();
    const schema = convertInputSchema(tool.inputSchema) as JsonSchema;

    const required = getRequiredFields(schema);
    expect(required).not.toContain("id");
    expect(getPropertyDefault(schema, "id")).toBe("default");
  });

  test("talend_app_session_create acepta {} como input válido", () => {
    const tool = createAppSessionCreateTool();
    const schema = convertInputSchema(tool.inputSchema);
    const required = getRequiredFields(schema);

    const emptyInput: Record<string, unknown> = {};
    for (const field of required) {
      expect(emptyInput).not.toHaveProperty(field);
    }
  });

  test("talend_app_session_get: sessionId es required (sin default)", () => {
    const tool = createAppSessionGetTool();
    const schema = convertInputSchema(tool.inputSchema) as JsonSchema;

    const required = getRequiredFields(schema);
    expect(required).toContain("sessionId");
    expect(getPropertyDefault(schema, "sessionId")).toBeUndefined();
  });

  test("talend_app_session_get acepta { sessionId } como input válido", () => {
    const tool = createAppSessionGetTool();
    const schema = convertInputSchema(tool.inputSchema);
    const required = getRequiredFields(schema);

    const input = { sessionId: "default" };
    for (const field of required) {
      expect(input).toHaveProperty(field);
    }
  });
});
