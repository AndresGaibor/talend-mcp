import { allTools as presentationTools } from "../tools/registry";
import { createStudioBridgeTools } from "../../talend/studio/bridge-tools";
import { studioToolDefs } from "../../tools/new-tools";

type ToolDef = {
  name: string;
  description: string;
  inputSchema: unknown;
  handler: (input: any) => Promise<unknown>;
};

type ToolSafetyAnnotation = {
  readOnlyHint: boolean;
  idempotentHint: boolean;
  destructiveHint: boolean;
  openWorldHint: boolean;
};

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

function dedupeTools(tools: ToolDef[]): ToolDef[] {
  const seen = new Set<string>();
  const result: ToolDef[] = [];

  for (const tool of tools) {
    if (seen.has(tool.name)) continue;
    seen.add(tool.name);
    result.push(tool);
  }

  return result;
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

  talend_coverage_report: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },

  talend_studio_process: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
  talend_diagnose_environment: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },

  talend_detect_open_jobs: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
  talend_read_latest_run_log: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
  talend_read_job_errors: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
  talend_summarize_open_job: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
  talend_view_logs: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
  talend_analyze_logs: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
  talend_list_open_editors: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
  talend_get_probable_active_job: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
  talend_analyze_job: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },

  talend_live_start: { readOnlyHint: false, idempotentHint: false, destructiveHint: false, openWorldHint: true },
  talend_live_stop: { readOnlyHint: false, idempotentHint: false, destructiveHint: false, openWorldHint: false },
  talend_live_status: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
  talend_latest_changes: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },

  repo_pull: { readOnlyHint: false, idempotentHint: false, destructiveHint: false, openWorldHint: false },
  repo_setup: { readOnlyHint: false, idempotentHint: false, destructiveHint: false, openWorldHint: false },
  repo_sources: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
  repo_status: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
  repo_switch: { readOnlyHint: false, idempotentHint: false, destructiveHint: false, openWorldHint: false },

  talend_full_analysis: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
  talend_duplicate_analysis: { readOnlyHint: false, idempotentHint: false, destructiveHint: false, openWorldHint: false },
  talend_update_analysis: { readOnlyHint: false, idempotentHint: false, destructiveHint: false, openWorldHint: false },
  talend_list_analyses: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
  talend_read_analysis: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
  talend_inspect_job: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
  talend_inspect_component: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
  talend_read_run_log: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
};

const TOOL_REQUIRES_WORKSPACE = new Set([
  "talend_detect_open_jobs", "talend_read_latest_run_log", "talend_read_job_errors",
  "talend_summarize_open_job", "talend_view_logs", "talend_analyze_logs",
]);

function getToolAnnotations(name: string): ToolSafetyAnnotation & { requiresWorkspace: boolean } {
  const aliasSource = TOOL_NAME_ALIASES[name];
  const resolvedName = aliasSource ?? name;
  const safety = TOOL_SAFETY[resolvedName];

  if (safety) {
    return {
      ...safety,
      requiresWorkspace: TOOL_REQUIRES_WORKSPACE.has(resolvedName),
    };
  }

  return {
    readOnlyHint: true,
    idempotentHint: true,
    destructiveHint: false,
    openWorldHint: false,
    requiresWorkspace: TOOL_REQUIRES_WORKSPACE.has(name),
  };
}

const registeredTools = dedupeTools([
  ...presentationTools,
  ...createStudioBridgeTools(),
  ...studioToolDefs,
]);

const aliasTools = buildAliasTools(registeredTools);

export function getRegisteredServerTools(): ToolDef[] {
  return [...registeredTools, ...aliasTools];
}

export function getRegisteredServerToolCount(): number {
  return registeredTools.length + aliasTools.length;
}

export function getRegisteredServerToolAnnotations(toolName: string) {
  return getToolAnnotations(toolName);
}
