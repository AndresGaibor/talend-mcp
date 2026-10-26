/**
 * Anotaciones de seguridad por tool.
 *
 * MCP usa estas pistas para que el cliente sepa si una tool lee, escribe o
 * destruye datos. El valor por defecto es el seguro en el sentido conservador:
 * una tool nueva sin entrada se declara de escritura, no de solo lectura.
 *
 * Al agregar una tool, agrega su entrada aca y su prueba en
 * `tests/tools/tool-conformance.test.ts`.
 */

type ToolSafetyAnnotation = {
  readOnlyHint: boolean;
  idempotentHint: boolean;
  destructiveHint: boolean;
  openWorldHint: boolean;
  requiresConfirmation?: boolean;
};

const TOOL_SAFETY: Record<string, ToolSafetyAnnotation> = {
  talend_bridge_ping: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
  talend_studio_ui_inventory: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
  talend_bridge_commands: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
  talend_bridge_launch_configs: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
  talend_bridge_events_recent: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
  talend_bridge_workbench_state: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
  talend_bridge_audit_environment: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
  talend_bridge_execute_command: { readOnlyHint: false, idempotentHint: false, destructiveHint: false, openWorldHint: true },
  talend_bridge_save_all: { readOnlyHint: false, idempotentHint: false, destructiveHint: false, openWorldHint: false },
  talend_bridge_save_active_editor: { readOnlyHint: false, idempotentHint: false, destructiveHint: false, openWorldHint: false },

  talend_jobs_list: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
  talend_jobs_read: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
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

  talend_datasets_inspect_csv_folder: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
  talend_datasets_infer_csv_schema: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
  talend_datasets_generate_raw_mappings: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
  talend_datasets_generate_raw_mapping: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },

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

  talend_deliverables_export_job: { readOnlyHint: false, idempotentHint: false, destructiveHint: false, openWorldHint: false },
  talend_deliverables_collect: { readOnlyHint: false, idempotentHint: false, destructiveHint: false, openWorldHint: false },
  talend_deliverables_validate: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
  talend_deliverable_validate_checklist: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
  talend_deliverables_create_package: { readOnlyHint: false, idempotentHint: false, destructiveHint: false, openWorldHint: false },

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

  talend_secrets_scan_project: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
  talend_secrets_scan_job: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
  talend_secrets_suggest_context_migration: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },

  talend_runs_list: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
  talend_runs_read: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
  talend_runs_start: { readOnlyHint: false, idempotentHint: false, destructiveHint: false, openWorldHint: true },
  talend_runs_start_exported: { readOnlyHint: false, idempotentHint: false, destructiveHint: false, openWorldHint: true },

  talend_errors_explain: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
  talend_errors_suggest_fix: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
  talend_errors_stats: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },

  talend_validation_validate_design: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
  talend_validation_validate_context_usage: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
  talend_validation_validate_audit_columns: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
  talend_validation_validate_performance: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },

  talend_evidence_pack_build: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
  talend_evidence_pack_export: { readOnlyHint: false, idempotentHint: false, destructiveHint: false, openWorldHint: false },

  talend_report_snippets_list: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
  talend_report_snippets_generate: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
};

const TOOL_REQUIRES_WORKSPACE = new Set([
  "talend_detect_open_jobs", "talend_read_latest_run_log", "talend_read_job_errors",
  "talend_summarize_open_job", "talend_view_logs", "talend_analyze_logs",
]);

export function getToolAnnotations(name: string): ToolSafetyAnnotation & { requiresWorkspace: boolean } {
  const safety = TOOL_SAFETY[name];

  if (safety) {
    return {
      ...safety,
      requiresWorkspace: TOOL_REQUIRES_WORKSPACE.has(name),
    };
  }

  return {
    readOnlyHint: false,
    idempotentHint: false,
    destructiveHint: false,
    openWorldHint: false,
    requiresWorkspace: TOOL_REQUIRES_WORKSPACE.has(name),
  };
}
