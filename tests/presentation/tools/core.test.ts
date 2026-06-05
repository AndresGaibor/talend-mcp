import { test, expect, describe } from "bun:test";
import { getRegisteredServerTools, getRegisteredServerToolAnnotations } from "../../../src/presentation/server/tool-registry";

const DANGEROUS_TOOLS = new Set([
  "talend_delete_job",
  "talend_snapshot_restore",
  "talend_delete_component",
  "talend_delete_connection",
  "talend_delete_context",
  "talend_delete_repository_context",
  "talend_delete_repository_context_parameter",
]);

const READONLY_TOOLS = new Set([
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
  "talend_datasets_inspect_csv_folder",
  "talend_datasets_infer_csv_schema",
  "talend_datasets_generate_raw_mappings",
  "talend_datasets_generate_raw_mapping",
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
]);

describe("Tool Registry Safety Annotations", () => {
  describe("TOOL_SAFETY coverage", () => {
    test("todas las tools registradas tienen entrada en TOOL_SAFETY o retornan默认值", () => {
      const tools = getRegisteredServerTools();
      for (const tool of tools) {
        const annotations = getRegisteredServerToolAnnotations(tool.name);
        expect(annotations).toBeDefined();
        expect(typeof annotations.readOnlyHint).toBe("boolean");
        expect(typeof annotations.idempotentHint).toBe("boolean");
        expect(typeof annotations.destructiveHint).toBe("boolean");
        expect(typeof annotations.openWorldHint).toBe("boolean");
        expect(typeof annotations.requiresWorkspace).toBe("boolean");
      }
    });

    test("las tools peligrosas tienen destructiveHint: true", () => {
      const tools = getRegisteredServerTools();
      for (const tool of tools) {
        if (DANGEROUS_TOOLS.has(tool.name)) {
          const annotations = getRegisteredServerToolAnnotations(tool.name);
          expect(
            annotations.destructiveHint,
            `${tool.name} es peligrosa y debe tener destructiveHint: true`,
          ).toBe(true);
        }
      }
    });

    test("las tools de solo lectura tienen readOnlyHint: true", () => {
      const tools = getRegisteredServerTools();
      for (const tool of tools) {
        if (tool.name.startsWith("talend_") && READONLY_TOOLS.has(tool.name)) {
          const annotations = getRegisteredServerToolAnnotations(tool.name);
          expect(
            annotations.readOnlyHint,
            `${tool.name} es readOnly y debe tener readOnlyHint: true`,
          ).toBe(true);
        }
      }
    });

    test("las tools peligrosas no son readOnly", () => {
      const tools = getRegisteredServerTools();
      for (const tool of tools) {
        if (DANGEROUS_TOOLS.has(tool.name)) {
          const annotations = getRegisteredServerToolAnnotations(tool.name);
          expect(
            annotations.readOnlyHint,
            `${tool.name} es peligrosa y no debe ser readOnly`,
          ).toBe(false);
        }
      }
    });

    test("las tools readOnly son también idempotent", () => {
      const tools = getRegisteredServerTools();
      for (const tool of tools) {
        const annotations = getRegisteredServerToolAnnotations(tool.name);
        if (annotations.readOnlyHint) {
          expect(
            annotations.idempotentHint,
            `${tool.name} es readOnly pero no es idempotent`,
          ).toBe(true);
        }
      }
    });

    test("las tools readOnly no son destructive", () => {
      const tools = getRegisteredServerTools();
      for (const tool of tools) {
        const annotations = getRegisteredServerToolAnnotations(tool.name);
        if (annotations.readOnlyHint) {
          expect(
            annotations.destructiveHint,
            `${tool.name} es readOnly pero tiene destructiveHint: true`,
          ).toBe(false);
        }
      }
    });
  });

  describe("inputSchema validation", () => {
    test("todas las tools tienen inputSchema definido", () => {
      const tools = getRegisteredServerTools();
      for (const tool of tools) {
        expect(
          tool.inputSchema,
          `${tool.name} no tiene inputSchema`,
        ).toBeDefined();
      }
    });

    test("inputSchema es un objeto válido (no null ni undefined)", () => {
      const tools = getRegisteredServerTools();
      for (const tool of tools) {
        expect(typeof tool.inputSchema).toBe("object");
        expect(tool.inputSchema).not.toBeNull();
      }
    });

    test("todas las tools tienen outputSchema definido", () => {
      const tools = getRegisteredServerTools();
      for (const tool of tools) {
        expect(
          tool.outputSchema,
          `${tool.name} no tiene outputSchema`,
        ).toBeDefined();
      }
    });
  });

  describe("annotation consistency", () => {
    test("annotations son consistentes: destructiveHint true implica readOnlyHint false", () => {
      const tools = getRegisteredServerTools();
      for (const tool of tools) {
        const annotations = getRegisteredServerToolAnnotations(tool.name);
        if (annotations.destructiveHint) {
          expect(
            annotations.readOnlyHint,
            `${tool.name} tiene destructiveHint true pero readOnlyHint es true también`,
          ).toBe(false);
        }
      }
    });

    test("annotation requiresWorkspace está presente para todas las tools", () => {
      const tools = getRegisteredServerTools();
      for (const tool of tools) {
        const annotations = getRegisteredServerToolAnnotations(tool.name);
        expect(typeof annotations.requiresWorkspace).toBe("boolean");
      }
    });

    test("openWorldHint indica tools que interactúan con el mundo externo", () => {
      const tools = getRegisteredServerTools();
      for (const tool of tools) {
        const annotations = getRegisteredServerToolAnnotations(tool.name);
        expect(typeof annotations.openWorldHint).toBe("boolean");
      }
    });
  });

  describe("tool names validation", () => {
    test("todas las tools de presentación tienen prefijo talend_", () => {
      const tools = getRegisteredServerTools().filter((t) => t.name.startsWith("talend_"));
      for (const tool of tools) {
        expect(tool.name).toMatch(/^talend_[a-z_]+$/);
      }
    });

    test("no hay tools duplicadas en el registro", () => {
      const tools = getRegisteredServerTools();
      const names = tools.map((t) => t.name);
      const uniqueNames = new Set(names);
      expect(names.length).toBe(uniqueNames.size);
    });

    describe("tool names uniqueness", () => {
    test("no hay tools con el mismo nombre en el registro", () => {
      const tools = getRegisteredServerTools();
      const names = tools.map((t) => t.name);
      const uniqueNames = new Set(names);
      expect(names.length).toBe(uniqueNames.size);
    });
  });
  });
});