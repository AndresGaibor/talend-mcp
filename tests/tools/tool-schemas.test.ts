import { test, expect, describe } from "bun:test";
import { z } from "zod/v4";

const GENERIC_TOOL_OUTPUT_SCHEMA = z.object({
  ok: z.boolean().optional(),
  source: z.string().optional(),
  confidence: z.union([
    z.literal("high"),
    z.literal("medium"),
    z.literal("low"),
    z.literal("none"),
  ]).optional(),
  endpoint: z.string().optional(),
  data: z.unknown().optional(),
  warning: z.string().optional(),
  limitations: z.array(z.string()).optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.string(), z.unknown()).optional(),
  }).optional(),
}).passthrough();

type ToolInputSchemas = {
  [key: string]: z.ZodType<unknown>;
};

const TOOL_INPUT_SCHEMAS: ToolInputSchemas = {
  talend_list_jobs: z.object({
    projectPath: z.string(),
  }),
  talend_read_job: z.object({
    jobName: z.string(),
    folderPath: z.string().optional(),
  }),
  talend_create_job: z.object({
    jobName: z.string(),
    version: z.string().optional(),
    defaultContext: z.string().optional(),
    label: z.string().optional(),
    folderPath: z.string().optional(),
    description: z.string().optional(),
    purpose: z.string().optional(),
  }),
  talend_delete_job: z.object({
    jobName: z.string(),
    folderPath: z.string().optional(),
  }),
  talend_duplicate_job: z.object({
    sourceJobName: z.string(),
    sourceFolderPath: z.string().optional(),
    targetJobName: z.string(),
    targetVersion: z.string().optional(),
    targetFolderPath: z.string().optional(),
  }),
  talend_rename_job: z.object({
    oldJobName: z.string(),
    newJobName: z.string(),
    folderPath: z.string().optional(),
  }),
  talend_move_job_to_folder: z.object({
    jobName: z.string(),
    folderPath: z.string(),
  }),
  talend_create_folder: z.object({
    folderPath: z.string(),
  }),
  talend_list_runs: z.object({
    jobName: z.string().optional(),
    limit: z.number().optional(),
  }),
  talend_read_run: z.object({
    runId: z.string(),
  }),
  talend_run_exported_job: z.object({
    jobName: z.string(),
    scriptPath: z.string().optional(),
    contextName: z.string().optional(),
    timeoutMs: z.number().optional(),
    params: z.record(z.string(), z.string()).optional(),
  }),
  talend_run_job: z.object({
    jobName: z.string(),
    contextName: z.string().optional(),
    timeoutMs: z.number().optional(),
    params: z.record(z.string(), z.string()).optional(),
  }),
  talend_patch_component: z.object({
    jobName: z.string(),
    folderPath: z.string().optional(),
    uniqueName: z.string(),
    patch: z.record(z.string(), z.unknown()),
  }),
  talend_delete_component: z.object({
    jobName: z.string(),
    folderPath: z.string().optional(),
    uniqueName: z.string(),
  }),
  talend_delete_connection: z.object({
    jobName: z.string(),
    folderPath: z.string().optional(),
    uniqueName: z.string(),
  }),
  talend_duplicate_component: z.object({
    jobName: z.string(),
    folderPath: z.string().optional(),
    sourceUniqueName: z.string(),
    targetUniqueName: z.string(),
  }),
  talend_move_component: z.object({
    jobName: z.string(),
    folderPath: z.string().optional(),
    uniqueName: z.string(),
    posX: z.number(),
    posY: z.number(),
  }),
  talend_update_component_parameter: z.object({
    jobName: z.string(),
    folderPath: z.string().optional(),
    uniqueName: z.string(),
    parameterName: z.string(),
    value: z.string(),
  }),
  talend_add_connection: z.object({
    jobName: z.string(),
    folderPath: z.string().optional(),
    sourceUniqueName: z.string(),
    targetUniqueName: z.string(),
    label: z.string().optional(),
    connectorName: z.string().optional(),
    metaname: z.string().optional(),
    uniqueName: z.string().optional(),
  }),
  talend_create_repository_context: z.object({
    projectPath: z.string(),
    name: z.string(),
    version: z.string().optional(),
    purpose: z.string().optional(),
    description: z.string().optional(),
  }),
  talend_delete_repository_context: z.object({
    projectPath: z.string(),
    contextName: z.string(),
  }),
  talend_upsert_repository_context_parameter: z.object({
    projectPath: z.string(),
    contextName: z.string(),
    parameterName: z.string(),
    value: z.string(),
    contextName_param: z.string().optional(),
    type: z.string().optional(),
    prompt: z.string().optional(),
  }),
  talend_list_project_contexts: z.object({
    projectPath: z.string(),
  }),
  talend_list_repository_contexts: z.object({
    projectPath: z.string(),
  }),
  talend_read_repository_context: z.object({
    projectPath: z.string(),
    contextName: z.string(),
  }),
  talend_repo_pull: z.object({
    repoPath: z.string(),
  }),
  talend_repo_setup: z.object({
    source: z.string(),
    branch: z.string().optional(),
  }),
  talend_repo_status: z.object({
    repoPath: z.string(),
  }),
  talend_repo_switch: z.object({
    repoPath: z.string(),
  }),
  talend_live_start: z.object({
    projectPath: z.string().optional(),
    workspacePath: z.string().optional(),
  }),
  talend_live_status: z.object({}),
  talend_live_stop: z.object({}),
  talend_detect_open_jobs: z.object({}),
  talend_latest_changes: z.object({}),
};

describe("Tool Schemas", () => {
  describe("Tool input schemas parse valid inputs", () => {
    test("talend_list_jobs parses valid input", () => {
      const schema = TOOL_INPUT_SCHEMAS["talend_list_jobs"]!;
      const result = schema.parse({ projectPath: "/path/to/project" }) as { projectPath: string };
      expect(result.projectPath).toBe("/path/to/project");
    });

    test("talend_read_job parses valid input with optional folderPath", () => {
      const schema = TOOL_INPUT_SCHEMAS["talend_read_job"]!;
      const result = schema.parse({ jobName: "MyJob" }) as { jobName: string };
      expect(result.jobName).toBe("MyJob");
      
      const resultWithFolder = schema.parse({ jobName: "MyJob", folderPath: "folder1" }) as { jobName: string; folderPath?: string };
      expect(resultWithFolder.folderPath).toBe("folder1");
    });

    test("talend_create_job parses all optional fields", () => {
      const schema = TOOL_INPUT_SCHEMAS["talend_create_job"]!;
      const fullInput = {
        jobName: "NewJob",
        version: "0.1",
        defaultContext: "Default",
        label: "My Label",
        folderPath: "folder1",
        description: "A description",
        purpose: "Data processing",
      };
      const result = schema.parse(fullInput) as { jobName: string; version?: string; defaultContext?: string };
      expect(result.jobName).toBe("NewJob");
      expect(result.version).toBe("0.1");
      expect(result.defaultContext).toBe("Default");
    });

    test("talend_delete_job parses required jobName", () => {
      const schema = TOOL_INPUT_SCHEMAS["talend_delete_job"]!;
      const result = schema.parse({ jobName: "JobToDelete" }) as { jobName: string };
      expect(result.jobName).toBe("JobToDelete");
    });

    test("talend_duplicate_job parses all fields", () => {
      const schema = TOOL_INPUT_SCHEMAS["talend_duplicate_job"]!;
      const result = schema.parse({
        sourceJobName: "SourceJob",
        targetJobName: "TargetJob",
      }) as { sourceJobName: string; targetJobName: string };
      expect(result.sourceJobName).toBe("SourceJob");
      expect(result.targetJobName).toBe("TargetJob");
    });

    test("talend_patch_component parses patch object", () => {
      const schema = TOOL_INPUT_SCHEMAS["talend_patch_component"]!;
      const result = schema.parse({
        jobName: "TestJob",
        uniqueName: "tMap_1",
        patch: { property1: "value1", property2: 42 },
      }) as { patch: Record<string, unknown> };
      expect(result.patch).toEqual({ property1: "value1", property2: 42 });
    });

    test("talend_run_exported_job parses all optional params", () => {
      const schema = TOOL_INPUT_SCHEMAS["talend_run_exported_job"]!;
      const result = schema.parse({
        jobName: "ExportedJob",
        scriptPath: "/scripts/run.sh",
        contextName: "Prod",
        timeoutMs: 30000,
        params: { param1: "value1", param2: "value2" },
      }) as { jobName: string; timeoutMs?: number; params?: Record<string, string> };
      expect(result.jobName).toBe("ExportedJob");
      expect(result.timeoutMs).toBe(30000);
      expect(result.params).toEqual({ param1: "value1", param2: "value2" });
    });

    test("talend_upsert_repository_context_parameter parses all fields", () => {
      const schema = TOOL_INPUT_SCHEMAS["talend_upsert_repository_context_parameter"]!;
      const result = schema.parse({
        projectPath: "/project",
        contextName: "MyContext",
        parameterName: "DB_HOST",
        value: "localhost",
        type: "String",
        prompt: "Database host",
      }) as { parameterName: string; value: string };
      expect(result.parameterName).toBe("DB_HOST");
      expect(result.value).toBe("localhost");
    });

    test("schema rejects invalid input", () => {
      const schema = TOOL_INPUT_SCHEMAS["talend_list_jobs"]!;
      expect(() => schema.parse({})).toThrow();
      expect(() => schema.parse({ projectPath: 123 })).toThrow();
    });

    test("all defined schemas parse their own name as valid input", () => {
      for (const [toolName, schemaEntry] of Object.entries(TOOL_INPUT_SCHEMAS)) {
        expect(schemaEntry).toBeDefined();
        const minimalInput = getMinimalInputForTool(toolName);
        expect(() => schemaEntry.parse(minimalInput)).not.toThrow();
      }
    });
  });

  describe("Tool output schemas produce valid outputs", () => {
    test("GENERIC_TOOL_OUTPUT_SCHEMA parses success response", () => {
      const output = {
        ok: true,
        source: "talend",
        confidence: "high" as const,
        data: { jobName: "TestJob" },
      };
      const result = GENERIC_TOOL_OUTPUT_SCHEMA.parse(output);
      expect(result.ok).toBe(true);
      expect(result.confidence).toBe("high");
    });

    test("GENERIC_TOOL_OUTPUT_SCHEMA parses error response", () => {
      const output = {
        ok: false,
        source: "talend",
        confidence: "none" as const,
        error: {
          code: "JOB_NOT_FOUND",
          message: "Job not found",
          details: { path: "/test" },
        },
      };
      const result = GENERIC_TOOL_OUTPUT_SCHEMA.parse(output);
      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe("JOB_NOT_FOUND");
    });

    test("GENERIC_TOOL_OUTPUT_SCHEMA parses with warnings", () => {
      const output = {
        ok: true,
        source: "talend",
        confidence: "medium" as const,
        warning: "Using default context",
        limitations: ["No schema validation"],
      };
      const result = GENERIC_TOOL_OUTPUT_SCHEMA.parse(output);
      expect(result.warning).toBe("Using default context");
      expect(result.limitations).toEqual(["No schema validation"]);
    });

    test("GENERIC_TOOL_OUTPUT_SCHEMA parses minimal response", () => {
      const output = { ok: true };
      const result = GENERIC_TOOL_OUTPUT_SCHEMA.parse(output);
      expect(result.ok).toBe(true);
    });

    test("GENERIC_TOOL_OUTPUT_SCHEMA parses data with complex types", () => {
      const output = {
        ok: true,
        source: "talend",
        confidence: "high" as const,
        data: {
          components: [
            { uniqueName: "tMap_1", componentName: "tMap" },
            { uniqueName: "tDBInput_1", componentName: "tDBInput" },
          ],
          connections: [
            { source: "tDBInput_1", target: "tMap_1" },
          ],
        },
      };
      const result = GENERIC_TOOL_OUTPUT_SCHEMA.parse(output);
      expect(result.data).toBeDefined();
    });
  });
});

function getMinimalInputForTool(toolName: string): Record<string, unknown> {
  const minimalInputs: Record<string, Record<string, unknown>> = {
    talend_list_jobs: { projectPath: "/project" },
    talend_read_job: { jobName: "Job" },
    talend_create_job: { jobName: "Job" },
    talend_delete_job: { jobName: "Job" },
    talend_duplicate_job: { sourceJobName: "Source", targetJobName: "Target" },
    talend_rename_job: { oldJobName: "Old", newJobName: "New" },
    talend_move_job_to_folder: { jobName: "Job", folderPath: "/folder" },
    talend_create_folder: { folderPath: "/folder" },
    talend_list_runs: {},
    talend_read_run: { runId: "run123" },
    talend_run_exported_job: { jobName: "Job" },
    talend_run_job: { jobName: "Job" },
    talend_patch_component: { jobName: "Job", uniqueName: "comp1", patch: {} },
    talend_delete_component: { jobName: "Job", uniqueName: "comp1" },
    talend_delete_connection: { jobName: "Job", uniqueName: "conn1" },
    talend_duplicate_component: { jobName: "Job", sourceUniqueName: "s1", targetUniqueName: "t1" },
    talend_move_component: { jobName: "Job", uniqueName: "comp1", posX: 0, posY: 0 },
    talend_update_component_parameter: { jobName: "Job", uniqueName: "comp1", parameterName: "p1", value: "v1" },
    talend_add_connection: { jobName: "Job", sourceUniqueName: "s1", targetUniqueName: "t1" },
    talend_create_repository_context: { projectPath: "/project", name: "ctx" },
    talend_delete_repository_context: { projectPath: "/project", contextName: "ctx" },
    talend_upsert_repository_context_parameter: { projectPath: "/project", contextName: "ctx", parameterName: "p", value: "v" },
    talend_list_project_contexts: { projectPath: "/project" },
    talend_list_repository_contexts: { projectPath: "/project" },
    talend_read_repository_context: { projectPath: "/project", contextName: "ctx" },
    talend_repo_pull: { repoPath: "/repo" },
    talend_repo_setup: { source: "origin" },
    talend_repo_status: { repoPath: "/repo" },
    talend_repo_switch: { repoPath: "/repo" },
    talend_live_start: {},
    talend_live_status: {},
    talend_live_stop: {},
    talend_detect_open_jobs: {},
    talend_latest_changes: {},
  };

  return minimalInputs[toolName] ?? {};
}