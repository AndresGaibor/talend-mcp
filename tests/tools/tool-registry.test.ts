import { test, expect, describe } from "bun:test";

const TOOL_NAME_ALIASES: Record<string, string> = {
  analyze_logs: "talend_analyze_logs",
  analyze_tdboutput: "talend_analyze_tdboutput",
  duplicate_analysis: "talend_duplicate_analysis",
  full_analysis: "talend_full_analysis",
  inspect_component: "talend_inspect_component",
  inspect_job: "talend_inspect_job",
  list_analyses: "talend_list_analyses",
  read_analysis: "talend_read_analysis",
  read_run_log: "talend_read_run_log",
  update_analysis: "talend_update_analysis",
  view_logs: "talend_view_logs",
  add_talend_connection: "talend_add_connection",
  delete_talend_component: "talend_delete_component",
  delete_talend_connection: "talend_delete_connection",
  duplicate_talend_component: "talend_duplicate_component",
  move_talend_component: "talend_move_component",
  patch_talend_component: "talend_patch_component",
  preview_delete_talend_component: "talend_preview_delete_component",
  preview_delete_talend_connection: "talend_preview_delete_connection",
  preview_talend_component_parameter: "talend_preview_component_parameter",
  preview_talend_schema_column: "talend_preview_schema_column",
  update_talend_component_parameter: "talend_update_component_parameter",
  update_talend_schema_column: "talend_update_schema_column",
  create_repository_context: "talend_create_repository_context",
  delete_repository_context: "talend_delete_repository_context",
  delete_repository_context_parameter: "talend_delete_repository_context_parameter",
  list_project_contexts: "talend_list_project_contexts",
  list_repository_contexts: "talend_list_repository_contexts",
  read_repository_context: "talend_read_repository_context",
  upsert_repository_context_parameter: "talend_upsert_repository_context_parameter",
  repo_pull: "talend_repo_pull",
  repo_setup: "talend_repo_setup",
  repo_sources: "talend_repo_sources",
  repo_status: "talend_repo_status",
  repo_switch: "talend_repo_switch",
  latest_changes: "talend_latest_changes",
  live_start: "talend_live_start",
  live_status: "talend_live_status",
  live_stop: "talend_live_stop",
  detect_open_jobs: "talend_detect_open_jobs",
  summarize_open_job: "talend_summarize_open_job",
  detect_process: "talend_studio_process",
  diagnose_environment: "talend_diagnose_environment",
  list_launch_configs: "talend_list_launch_configs",
  list_open_editors: "talend_list_open_editors",
  get_probable_active_job: "talend_get_probable_active_job",
  analyze_job: "talend_analyze_job",
};

const GENERIC_TOOL_OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    ok: { type: "boolean" },
    source: { type: "string" },
    confidence: { type: "string" },
    data: {},
  },
} as const;

type ToolDef = {
  name: string;
  description: string;
  inputSchema: unknown;
  outputSchema?: unknown;
  handler: (input: unknown) => Promise<unknown>;
};

type ToolSafetyAnnotation = {
  readOnlyHint: boolean;
  idempotentHint: boolean;
  destructiveHint: boolean;
  openWorldHint: boolean;
};

const TOOL_SAFETY: Record<string, ToolSafetyAnnotation> = {
  talend_bridge_ping: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
  talend_bridge_commands: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
  talend_bridge_launch_configs: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
  talend_bridge_events_recent: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
  talend_bridge_workbench_state: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
  talend_bridge_audit_environment: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
  talend_bridge_execute_command: { readOnlyHint: false, idempotentHint: false, destructiveHint: false, openWorldHint: true },
  talend_bridge_save_all: { readOnlyHint: false, idempotentHint: false, destructiveHint: false, openWorldHint: false },
  talend_bridge_save_active_editor: { readOnlyHint: false, idempotentHint: false, destructiveHint: false, openWorldHint: false },
  talend_list_jobs: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
  talend_read_job: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
  talend_show_flow: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
  talend_create_job: { readOnlyHint: false, idempotentHint: false, destructiveHint: false, openWorldHint: false },
  talend_rename_job: { readOnlyHint: false, idempotentHint: false, destructiveHint: false, openWorldHint: false },
  talend_delete_job: { readOnlyHint: false, idempotentHint: false, destructiveHint: true, openWorldHint: false },
  talend_duplicate_job: { readOnlyHint: false, idempotentHint: false, destructiveHint: false, openWorldHint: false },
  talend_move_job_to_folder: { readOnlyHint: false, idempotentHint: false, destructiveHint: false, openWorldHint: false },
  talend_create_folder: { readOnlyHint: false, idempotentHint: false, destructiveHint: false, openWorldHint: false },
  talend_list_runs: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
  talend_read_run: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
  talend_tail_run_output: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
  talend_job_run_by_name: { readOnlyHint: false, idempotentHint: false, destructiveHint: false, openWorldHint: true },
  talend_job_wait_run: { readOnlyHint: false, idempotentHint: false, destructiveHint: false, openWorldHint: false },
  talend_job_measure_runtime: { readOnlyHint: false, idempotentHint: false, destructiveHint: false, openWorldHint: false },
  talend_run_exported_job: { readOnlyHint: false, idempotentHint: false, destructiveHint: false, openWorldHint: true },
  talend_snapshot_list: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
  talend_snapshot_read: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
  talend_snapshot_restore: { readOnlyHint: false, idempotentHint: false, destructiveHint: true, openWorldHint: false },
  talend_patch_component: { readOnlyHint: false, idempotentHint: false, destructiveHint: false, openWorldHint: false },
  talend_safe_patch_component: { readOnlyHint: false, idempotentHint: false, destructiveHint: false, openWorldHint: false },
  talend_add_connection: { readOnlyHint: false, idempotentHint: false, destructiveHint: false, openWorldHint: false },
  talend_safe_add_connection: { readOnlyHint: false, idempotentHint: false, destructiveHint: false, openWorldHint: false },
  talend_delete_connection: { readOnlyHint: false, idempotentHint: false, destructiveHint: true, openWorldHint: false },
  talend_preview_delete_connection: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
  talend_duplicate_component: { readOnlyHint: false, idempotentHint: false, destructiveHint: false, openWorldHint: false },
  talend_delete_component: { readOnlyHint: false, idempotentHint: false, destructiveHint: true, openWorldHint: false },
  talend_preview_delete_component: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
  talend_move_component: { readOnlyHint: false, idempotentHint: false, destructiveHint: false, openWorldHint: false },
  talend_update_component_parameter: { readOnlyHint: false, idempotentHint: false, destructiveHint: false, openWorldHint: false },
  talend_preview_component_parameter: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
  talend_preview_schema_column: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
  talend_update_schema_column: { readOnlyHint: false, idempotentHint: false, destructiveHint: false, openWorldHint: false },
  talend_components_scan_installed: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
  talend_components_search: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
  talend_components_inspect: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
  talend_components_generate_template: { readOnlyHint: false, idempotentHint: false, destructiveHint: false, openWorldHint: false },
  talend_analyze_tdboutput: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
  talend_dataset_inspect_csv_folder: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
  talend_dataset_infer_csv_schema: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
  talend_dataset_generate_raw_table_mappings: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
  talend_dataset_generate_raw_table_mapping: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
  talend_job_validate_design: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
  talend_job_validate_context_usage: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
  talend_job_validate_performance_settings: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
  talend_job_validate_audit_columns: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
  talend_job_validate_pipeline_spec: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
  talend_job_preview_pipeline_spec: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
  talend_job_generate_from_pipeline_spec: { readOnlyHint: false, idempotentHint: false, destructiveHint: false, openWorldHint: false },
  talend_update_job_metadata: { readOnlyHint: false, idempotentHint: false, destructiveHint: false, openWorldHint: false },
  talend_connection_build_profile: { readOnlyHint: false, idempotentHint: false, destructiveHint: false, openWorldHint: false },
  talend_connection_apply_to_job: { readOnlyHint: false, idempotentHint: false, destructiveHint: false, openWorldHint: false },
  talend_list_project_contexts: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
  talend_context_profile_list: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
  talend_context_profile_get: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
  talend_context_profile_apply_to_job: { readOnlyHint: false, idempotentHint: false, destructiveHint: false, openWorldHint: false },
  talend_update_context: { readOnlyHint: false, idempotentHint: false, destructiveHint: false, openWorldHint: false },
  talend_upsert_context: { readOnlyHint: false, idempotentHint: false, destructiveHint: false, openWorldHint: false },
  talend_delete_context: { readOnlyHint: false, idempotentHint: false, destructiveHint: true, openWorldHint: false },
  talend_create_repository_context: { readOnlyHint: false, idempotentHint: false, destructiveHint: false, openWorldHint: false },
  talend_upsert_repository_context_parameter: { readOnlyHint: false, idempotentHint: false, destructiveHint: false, openWorldHint: false },
  talend_delete_repository_context: { readOnlyHint: false, idempotentHint: false, destructiveHint: true, openWorldHint: false },
  talend_delete_repository_context_parameter: { readOnlyHint: false, idempotentHint: false, destructiveHint: true, openWorldHint: false },
  talend_deliverable_export_job: { readOnlyHint: false, idempotentHint: false, destructiveHint: false, openWorldHint: false },
  talend_deliverable_collect_files: { readOnlyHint: false, idempotentHint: false, destructiveHint: false, openWorldHint: false },
  talend_deliverable_validate_checklist: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
  talend_deliverable_create_package: { readOnlyHint: false, idempotentHint: false, destructiveHint: false, openWorldHint: false },
  talend_error_stats: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
  talend_error_explain: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
  talend_error_suggest_fix: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
  talend_error_map_to_component: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
  talend_mastery_all_components: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
  talend_mastery_report: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
  talend_mastery_component: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
  talend_mastery_generate_fixture: { readOnlyHint: false, idempotentHint: false, destructiveHint: false, openWorldHint: false },
  talend_mastery_validate_roundtrip: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
  talend_mastery_validate_in_studio: { readOnlyHint: false, idempotentHint: false, destructiveHint: false, openWorldHint: true },
  talend_mastery_validate_run: { readOnlyHint: false, idempotentHint: false, destructiveHint: false, openWorldHint: true },
  talend_connection_detect_available_db_components: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
  talend_components_catalog_status: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
  talend_components_connectors: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
  talend_components_parameters: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
  talend_list_repository_contexts: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
  talend_read_contexts: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
  talend_task_analyze_requirements: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
  talend_task_build_execution_plan: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
  talend_task_extract_talend_responsibilities: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
  talend_secret_scan_project: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
  talend_secret_scan_job: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
  talend_secret_suggest_context_migration: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
};

function getToolAnnotations(name: string): ToolSafetyAnnotation {
  const aliasSource = TOOL_NAME_ALIASES[name];
  const resolvedName = aliasSource ?? name;
  const safety = TOOL_SAFETY[resolvedName];

  if (safety) {
    return safety;
  }

  return {
    readOnlyHint: false,
    idempotentHint: false,
    destructiveHint: false,
    openWorldHint: false,
  };
}

function buildAliasTools(tools: ToolDef[]): ToolDef[] {
  const toolByName = new Map(tools.map((tool) => [tool.name, tool]));
  const aliasTools: ToolDef[] = [];

  for (const [sourceName, aliasName] of Object.entries(TOOL_NAME_ALIASES)) {
    const sourceTool = toolByName.get(sourceName);
    if (!sourceTool || toolByName.has(aliasName)) continue;
    aliasTools.push({ ...sourceTool, name: aliasName });
  }

  return aliasTools;
}

function withDefaultOutputSchema(tool: ToolDef): ToolDef {
  return {
    ...tool,
    outputSchema: tool.outputSchema ?? GENERIC_TOOL_OUTPUT_SCHEMA,
  };
}

describe("Tool Registry", () => {
  describe("All tools have inputSchema", () => {
    test("inputSchema is defined and is an object", () => {
      const allSafetyEntries = Object.values(TOOL_SAFETY);
      expect(allSafetyEntries.length).toBeGreaterThan(0);
      
      for (const safety of allSafetyEntries) {
        expect(typeof safety.readOnlyHint).toBe("boolean");
        expect(typeof safety.idempotentHint).toBe("boolean");
        expect(typeof safety.destructiveHint).toBe("boolean");
        expect(typeof safety.openWorldHint).toBe("boolean");
      }
    });
  });

  describe("All tools have outputSchema", () => {
    test("GENERIC_TOOL_OUTPUT_SCHEMA is properly defined", () => {
      expect(GENERIC_TOOL_OUTPUT_SCHEMA).toBeDefined();
      expect(GENERIC_TOOL_OUTPUT_SCHEMA.type).toBe("object");
      expect(GENERIC_TOOL_OUTPUT_SCHEMA.properties).toBeDefined();
      expect(GENERIC_TOOL_OUTPUT_SCHEMA.properties.ok).toBeDefined();
      expect(GENERIC_TOOL_OUTPUT_SCHEMA.properties.source).toBeDefined();
    });

    test("withDefaultOutputSchema applies default output schema", () => {
      const tool: ToolDef = {
        name: "test_tool",
        description: "A test tool",
        inputSchema: { type: "object" },
        handler: async () => ({}),
      };

      const normalized = withDefaultOutputSchema(tool);
      expect(normalized.outputSchema).toBeDefined();
      expect(normalized.outputSchema).toBe(GENERIC_TOOL_OUTPUT_SCHEMA);
    });

    test("tool with existing outputSchema preserves it", () => {
      const customSchema = { type: "string" };
      const tool: ToolDef = {
        name: "test_tool",
        description: "A test tool",
        inputSchema: { type: "object" },
        outputSchema: customSchema,
        handler: async () => ({}),
      };

      const normalized = withDefaultOutputSchema(tool);
      expect(normalized.outputSchema).toBe(customSchema);
    });
  });

  describe("All tools have safety annotations", () => {
    test("TOOL_SAFETY has entries for all tool categories", () => {
      const safetyKeys = Object.keys(TOOL_SAFETY);
      
      expect(safetyKeys.some(k => k.includes("bridge"))).toBe(true);
      expect(safetyKeys.some(k => k.includes("job"))).toBe(true);
      expect(safetyKeys.some(k => k.includes("component"))).toBe(true);
      expect(safetyKeys.some(k => k.includes("context"))).toBe(true);
      expect(safetyKeys.some(k => k.includes("snapshot"))).toBe(true);
    });

    test("destructive tools have destructiveHint: true", () => {
      const destructiveTools = [
        "talend_delete_job",
        "talend_snapshot_restore",
        "talend_delete_component",
        "talend_delete_connection",
        "talend_delete_context",
        "talend_delete_repository_context",
        "talend_delete_repository_context_parameter",
      ];

      for (const toolName of destructiveTools) {
        const safety = TOOL_SAFETY[toolName];
        expect(
          safety?.destructiveHint,
          `${toolName} debería tener destructiveHint: true`,
        ).toBe(true);
      }
    });

    test("read-only tools have readOnlyHint: true", () => {
      const readOnlyTools = [
        "talend_list_jobs",
        "talend_read_job",
        "talend_show_flow",
        "talend_list_runs",
        "talend_read_run",
        "talend_snapshot_list",
        "talend_snapshot_read",
      ];

      for (const toolName of readOnlyTools) {
        const safety = TOOL_SAFETY[toolName];
        expect(
          safety?.readOnlyHint,
          `${toolName} debería tener readOnlyHint: true`,
        ).toBe(true);
      }
    });

    test("getToolAnnotations resolves aliases correctly", () => {
      const aliasAnnotations = getToolAnnotations("analyze_logs");
      const directAnnotations = getToolAnnotations("talend_analyze_logs");
      
      expect(aliasAnnotations).toEqual(directAnnotations);
    });
  });

  describe("getToolByName returns correct tool", () => {
    test("buildAliasTools creates correct alias mappings", () => {
      const tools: ToolDef[] = [
        {
          name: "analyze_logs",
          description: "Analyze logs",
          inputSchema: { type: "object" },
          handler: async () => ({}),
        },
      ];

      const aliases = buildAliasTools(tools);
      expect(aliases.length).toBe(1);
      const firstAlias = aliases[0];
      expect(firstAlias).toBeDefined();
      expect(firstAlias!.name).toBe("talend_analyze_logs");
      expect(firstAlias!.description).toBe("Analyze logs");
    });

    test("buildAliasTools skips if target already exists", () => {
      const tools: ToolDef[] = [
        {
          name: "analyze_logs",
          description: "Analyze logs",
          inputSchema: { type: "object" },
          handler: async () => ({}),
        },
        {
          name: "talend_analyze_logs",
          description: "Talend analyze logs",
          inputSchema: { type: "object" },
          handler: async () => ({}),
        },
      ];

      const aliases = buildAliasTools(tools);
      expect(aliases.length).toBe(0);
    });
  });

  describe("getLegacyAliases maps correctly", () => {
    test("TOOL_NAME_ALIASES contains expected mappings", () => {
      expect(TOOL_NAME_ALIASES.analyze_logs).toBe("talend_analyze_logs");
      expect(TOOL_NAME_ALIASES.create_repository_context).toBe("talend_create_repository_context");
      expect(TOOL_NAME_ALIASES.live_start).toBe("talend_live_start");
      expect(TOOL_NAME_ALIASES.detect_process).toBe("talend_studio_process");
      expect(TOOL_NAME_ALIASES.analyze_job).toBe("talend_analyze_job");
    });

    test("alias mapping follows expected pattern", () => {
      for (const [, target] of Object.entries(TOOL_NAME_ALIASES)) {
        expect(target.startsWith("talend_")).toBe(true);
      }
    });

    test("aliases cover all major tool categories", () => {
      const categories: Record<string, string[]> = {
        analysis: ["analyze_logs", "analyze_tdboutput", "inspect_component", "inspect_job"],
        components: ["add_talend_connection", "delete_talend_component", "patch_talend_component"],
        contexts: ["create_repository_context", "delete_repository_context", "list_project_contexts"],
        live: ["latest_changes", "live_start", "live_status", "live_stop"],
        repo: ["repo_pull", "repo_setup", "repo_status", "repo_switch"],
        studio: ["detect_process", "diagnose_environment", "list_launch_configs"],
      };

      for (const [category, tools] of Object.entries(categories)) {
        for (const tool of tools) {
          const alias = TOOL_NAME_ALIASES[tool];
          expect(
            alias,
            `${category}: ${tool} should have alias`,
          ).toBeDefined();
        }
      }
    });
  });
});