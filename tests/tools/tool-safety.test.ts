import { test, expect, describe } from "bun:test";

type ToolSafetyAnnotation = {
  readOnlyHint: boolean;
  idempotentHint: boolean;
  destructiveHint: boolean;
  openWorldHint: boolean;
  requiresWorkspace?: boolean;
  requiresConfirmation?: boolean;
  risk?: string;
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

const DANGEROUS_TOOLS = [
  "talend_delete_job",
  "talend_snapshot_restore",
  "talend_delete_component",
  "talend_delete_connection",
  "talend_delete_context",
  "talend_delete_repository_context",
  "talend_delete_repository_context_parameter",
];

const READONLY_TOOLS = [
  "talend_bridge_ping",
  "talend_bridge_commands",
  "talend_bridge_launch_configs",
  "talend_bridge_events_recent",
  "talend_bridge_workbench_state",
  "talend_bridge_audit_environment",
  "talend_list_jobs",
  "talend_read_job",
  "talend_show_flow",
  "talend_list_runs",
  "talend_read_run",
  "talend_tail_run_output",
  "talend_snapshot_list",
  "talend_snapshot_read",
  "talend_preview_delete_connection",
  "talend_preview_delete_component",
  "talend_preview_schema_column",
  "talend_preview_component_parameter",
  "talend_components_scan_installed",
  "talend_components_search",
  "talend_components_inspect",
  "talend_analyze_tdboutput",
  "talend_dataset_inspect_csv_folder",
  "talend_dataset_infer_csv_schema",
  "talend_dataset_generate_raw_table_mappings",
  "talend_dataset_generate_raw_table_mapping",
  "talend_job_validate_design",
  "talend_job_validate_context_usage",
  "talend_job_validate_performance_settings",
  "talend_job_validate_audit_columns",
  "talend_job_validate_pipeline_spec",
  "talend_job_preview_pipeline_spec",
  "talend_list_project_contexts",
  "talend_context_profile_list",
  "talend_context_profile_get",
  "talend_deliverable_validate_checklist",
  "talend_error_stats",
  "talend_error_explain",
  "talend_error_suggest_fix",
  "talend_error_map_to_component",
  "talend_mastery_all_components",
  "talend_mastery_report",
  "talend_mastery_component",
  "talend_mastery_validate_roundtrip",
  "talend_connection_detect_available_db_components",
  "talend_components_catalog_status",
  "talend_components_connectors",
  "talend_components_parameters",
  "talend_list_repository_contexts",
  "talend_read_contexts",
  "talend_task_analyze_requirements",
  "talend_task_build_execution_plan",
  "talend_task_extract_talend_responsibilities",
  "talend_secret_scan_project",
  "talend_secret_scan_job",
  "talend_secret_suggest_context_migration",
];

const DANGEROUS_ACTION_TOOLS = [
  "create",
  "apply",
  "patch",
  "restore",
  "export",
];

describe("Tool Safety", () => {
  describe("Dangerous tools have requiresConfirmation: true", () => {
    test("delete tools have destructiveHint: true", () => {
      for (const toolName of DANGEROUS_TOOLS) {
        const safety = TOOL_SAFETY[toolName];
        expect(safety).toBeDefined();
        expect(
          safety!.destructiveHint,
          `${toolName} debe tener destructiveHint: true`,
        ).toBe(true);
      }
    });

    test("dangerous action tools are not read-only", () => {
      for (const toolName of DANGEROUS_TOOLS) {
        const safety = TOOL_SAFETY[toolName];
        expect(safety).toBeDefined();
        expect(
          safety!.readOnlyHint,
          `${toolName} no debe ser readOnly`,
        ).toBe(false);
      }
    });

    test("create tools are not destructive but modify state", () => {
      const createTools = Object.keys(TOOL_SAFETY).filter((name) =>
        name.includes("create") && !name.includes("delete"),
      );
      
      for (const toolName of createTools) {
        const safety = TOOL_SAFETY[toolName]!;
        expect(
          safety.destructiveHint,
          `${toolName} no debería ser destructivo`,
        ).toBe(false);
      }
    });

    test("apply tools modify existing resources", () => {
      const applyTools = Object.keys(TOOL_SAFETY).filter((name) =>
        name.includes("apply"),
      );
      
      for (const toolName of applyTools) {
        const safety = TOOL_SAFETY[toolName]!;
        expect(safety.readOnlyHint).toBe(false);
        expect(safety.destructiveHint).toBe(false);
      }
    });

    test("patch tools modify existing resources", () => {
      const patchTools = Object.keys(TOOL_SAFETY).filter((name) =>
        name.includes("patch"),
      );
      
      for (const toolName of patchTools) {
        const safety = TOOL_SAFETY[toolName]!;
        expect(safety.readOnlyHint).toBe(false);
      }
    });

    test("restore tools are destructive", () => {
      const restoreTools = Object.keys(TOOL_SAFETY).filter((name) =>
        name.includes("restore"),
      );
      
      for (const toolName of restoreTools) {
        const safety = TOOL_SAFETY[toolName]!;
        expect(
          safety.destructiveHint,
          `${toolName} debería ser destructivo`,
        ).toBe(true);
      }
    });

    test("export tools interact with external world", () => {
      const exportTools = Object.keys(TOOL_SAFETY).filter((name) =>
        name.includes("export") && TOOL_SAFETY[name]!.openWorldHint,
      );
      
      expect(exportTools.length).toBeGreaterThan(0);
      
      for (const toolName of exportTools) {
        const safety = TOOL_SAFETY[toolName]!;
        expect(safety.openWorldHint).toBe(true);
      }
    });
  });

  describe("Read-only tools have readOnlyHint: true", () => {
    test("all read-only tools have readOnlyHint: true", () => {
      for (const toolName of READONLY_TOOLS) {
        const safety = TOOL_SAFETY[toolName];
        expect(safety).toBeDefined();
        expect(
          safety!.readOnlyHint,
          `${toolName} debe tener readOnlyHint: true`,
        ).toBe(true);
      }
    });

    test("read-only tools are also idempotent", () => {
      for (const toolName of READONLY_TOOLS) {
        const safety = TOOL_SAFETY[toolName]!;
        expect(
          safety.idempotentHint,
          `${toolName} debe ser idempotente`,
        ).toBe(true);
      }
    });

    test("read-only tools are not destructive", () => {
      for (const toolName of READONLY_TOOLS) {
        const safety = TOOL_SAFETY[toolName]!;
        expect(
          safety.destructiveHint,
          `${toolName} no debe ser destructivo`,
        ).toBe(false);
      }
    });

    test("preview tools are read-only", () => {
      const previewTools = Object.keys(TOOL_SAFETY).filter((name) =>
        name.includes("preview"),
      );
      
      for (const toolName of previewTools) {
        const safety = TOOL_SAFETY[toolName]!;
        expect(
          safety.readOnlyHint,
          `${toolName} debe ser readOnly`,
        ).toBe(true);
        expect(
          safety.idempotentHint,
          `${toolName} debe ser idempotente`,
        ).toBe(true);
      }
    });

    test("list tools are read-only", () => {
      const listTools = Object.keys(TOOL_SAFETY).filter((name) =>
        name.includes("list"),
      );
      
      for (const toolName of listTools) {
        const safety = TOOL_SAFETY[toolName]!;
        expect(
          safety.readOnlyHint,
          `${toolName} debe ser readOnly`,
        ).toBe(true);
      }
    });

    test("read tools are read-only", () => {
      const readTools = Object.keys(TOOL_SAFETY).filter((name) =>
        name.startsWith("talend_read_") || name.includes("_read"),
      );
      
      for (const toolName of readTools) {
        const safety = TOOL_SAFETY[toolName]!;
        expect(
          safety.readOnlyHint,
          `${toolName} debe ser readOnly`,
        ).toBe(true);
      }
    });

    test("validate tools are read-only", () => {
      const validateTools = Object.keys(TOOL_SAFETY).filter((name) =>
        name.includes("validate") && name !== "talend_mastery_validate_in_studio" && name !== "talend_mastery_validate_run",
      );
      
      for (const toolName of validateTools) {
        const safety = TOOL_SAFETY[toolName]!;
        expect(
          safety.readOnlyHint,
          `${toolName} debe ser readOnly`,
        ).toBe(true);
      }
    });
  });

  describe("Safety annotation consistency", () => {
    test("all tools have all required safety fields", () => {
      for (const [toolName, safety] of Object.entries(TOOL_SAFETY)) {
        expect(typeof safety.readOnlyHint).toBe("boolean");
        expect(typeof safety.idempotentHint).toBe("boolean");
        expect(typeof safety.destructiveHint).toBe("boolean");
        expect(typeof safety.openWorldHint).toBe("boolean");
      }
    });

    test("destructiveHint true implies readOnlyHint false", () => {
      for (const [toolName, safety] of Object.entries(TOOL_SAFETY)) {
        if (safety.destructiveHint) {
          expect(
            safety.readOnlyHint,
            `${toolName} tiene destructiveHint true pero readOnlyHint también es true`,
          ).toBe(false);
        }
      }
    });

    test("readOnlyHint true implies destructiveHint false", () => {
      for (const [toolName, safety] of Object.entries(TOOL_SAFETY)) {
        if (safety.readOnlyHint) {
          expect(
            safety.destructiveHint,
            `${toolName} tiene readOnlyHint true pero destructiveHint también es true`,
          ).toBe(false);
        }
      }
    });

    test("openWorldHint tools are not purely local", () => {
      const openWorldTools = Object.keys(TOOL_SAFETY).filter((name) =>
        TOOL_SAFETY[name]!.openWorldHint,
      );
      
      expect(openWorldTools.length).toBeGreaterThan(0);
      
      for (const toolName of openWorldTools) {
        const safety = TOOL_SAFETY[toolName]!;
        expect(safety.openWorldHint).toBe(true);
      }
    });

    test("bridge tools are read-only or execute commands", () => {
      const bridgeTools = Object.keys(TOOL_SAFETY).filter((name) =>
        name.includes("bridge"),
      );
      
      for (const toolName of bridgeTools) {
        const safety = TOOL_SAFETY[toolName]!;
        if (safety.readOnlyHint) {
          expect(safety.idempotentHint).toBe(true);
        }
      }
    });
  });
});