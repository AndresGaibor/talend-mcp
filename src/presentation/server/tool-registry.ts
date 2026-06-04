import { allTools as presentationTools } from "../tools/registry";
import { createStudioBridgeTools } from "../../talend/studio/bridge-tools";
import { studioToolDefs } from "../../tools/new-tools";

type ToolDef = {
  name: string;
  description: string;
  inputSchema: unknown;
  handler: (input: any) => Promise<unknown>;
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

function getToolAnnotations(name: string) {
  const writeTools = new Set([
    "talend_update_component_parameter", "talend_patch_component", "talend_update_schema_column",
    "talend_duplicate_component", "talend_add_connection", "talend_update_context",
    "talend_upsert_context", "talend_delete_context", "talend_update_job_metadata",
    "talend_update_analysis", "talend_duplicate_analysis", "talend_delete_component",
    "talend_delete_connection", "talend_move_component", "talend_create_job",
    "talend_create_folder", "talend_rename_job", "talend_delete_job", "talend_duplicate_job",
    "talend_move_job_to_folder", "talend_run_exported_job", "talend_live_start", "talend_live_stop",
    "create_repository_context", "upsert_repository_context_parameter", "delete_repository_context",
    "delete_repository_context_parameter", "repo_setup", "repo_pull",
  ]);
  const workspaceTools = new Set([
    "talend_detect_open_jobs", "talend_read_latest_run_log", "talend_read_job_errors",
    "talend_summarize_open_job", "talend_view_logs", "talend_analyze_logs",
  ]);

  return {
    readOnlyHint: !writeTools.has(name),
    idempotentHint: !writeTools.has(name),
    requiresWorkspace: workspaceTools.has(name),
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
