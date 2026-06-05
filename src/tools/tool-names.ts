export const TOOL_NAMES = {
  JOBS: {
    LIST: "talend_jobs_list",
    READ: "talend_jobs_read",
    CREATE: "talend_create_job",
    DELETE: "talend_delete_job",
    RENAME: "talend_rename_job",
    DUPLICATE: "talend_duplicate_job",
    MOVE_TO_FOLDER: "talend_move_job_to_folder",
    CREATE_FOLDER: "talend_create_folder",
    SHOW_FLOW: "talend_show_flow",
    LIST_PATTERNS: "talend_jobs_list_patterns",
    DETECT_ANTIPATTERNS: "talend_jobs_detect_antipatterns",
    PATCH_COMPONENT: "talend_jobs_patch_component",
    PREVIEW_PIPELINE_SPEC: "talend_jobs_preview_pipeline_spec",
    VALIDATE_PIPELINE_SPEC: "talend_jobs_validate_pipeline_spec",
    APPLY_PIPELINE_SPEC: "talend_jobs_apply_pipeline_spec",
    GENERATE_FROM_PIPELINE_SPEC: "talend_job_generate_from_pipeline_spec",
    UPDATE_METADATA: "talend_update_job_metadata",
  } as const,

  DATASETS: {
    INSPECT_CSV_FOLDER: "talend_datasets_inspect_csv_folder",
    INFER_CSV_SCHEMA: "talend_datasets_infer_csv_schema",
    GENERATE_RAW_MAPPINGS: "talend_datasets_generate_raw_mappings",
  } as const,

  BRIDGE: {
    PING: "talend_bridge_ping",
    COMMANDS: "talend_bridge_commands",
    LAUNCH_CONFIGS: "talend_bridge_launch_configs",
    EVENTS_RECENT: "talend_bridge_events_recent",
    WORKBENCH_STATE: "talend_bridge_workbench_state",
    AUDIT_ENVIRONMENT: "talend_bridge_audit_environment",
    EXECUTE_COMMAND: "talend_bridge_execute_command",
    SAVE_ALL: "talend_bridge_save_all",
    SAVE_ACTIVE_EDITOR: "talend_bridge_save_active_editor",
    WORKSPACE_STATE: "talend_bridge_workspace_state",
    PROBLEMS_MARKERS: "talend_bridge_problems_markers",
  } as const,

  RUNS: {
    LIST: "talend_runs_list",
    READ: "talend_runs_read",
    START: "talend_runs_start",
    START_EXPORTED: "talend_runs_start_exported",
    TAIL_OUTPUT: "talend_tail_run_output",
    RUN_BY_NAME: "talend_job_run_by_name",
    WAIT_RUN: "talend_job_wait_run",
    MEASURE_RUNTIME: "talend_job_measure_runtime",
  } as const,

  SNAPSHOTS: {
    LIST: "talend_snapshots_list",
    READ: "talend_snapshots_read",
    CREATE: "talend_snapshots_create",
    DIFF: "talend_snapshots_diff",
    RESTORE: "talend_snapshots_restore",
  } as const,

  SECRETS: {
    SCAN_PROJECT: "talend_secrets_scan_project",
    SCAN_JOB: "talend_secrets_scan_job",
    SUGGEST_CONTEXT_MIGRATION: "talend_secrets_suggest_context_migration",
  } as const,

  ERRORS: {
    EXPLAIN: "talend_errors_explain",
    SUGGEST_FIX: "talend_errors_suggest_fix",
    STATS: "talend_errors_stats",
  } as const,

  VALIDATION: {
    VALIDATE_DESIGN: "talend_validation_validate_design",
    VALIDATE_CONTEXT_USAGE: "talend_validation_validate_context_usage",
    VALIDATE_AUDIT_COLUMNS: "talend_validation_validate_audit_columns",
    VALIDATE_PERFORMANCE: "talend_validation_validate_performance",
  } as const,

  DELIVERABLES: {
    EXPORT_JOB: "talend_deliverables_export_job",
    COLLECT: "talend_deliverables_collect",
    VALIDATE: "talend_deliverables_validate",
    CREATE_PACKAGE: "talend_deliverables_create_package",
  } as const,

  COMPONENTS: {
    SCAN_INSTALLED: "talend_components_scan_installed",
    SEARCH: "talend_components_search",
    INSPECT: "talend_components_inspect",
    GENERATE_TEMPLATE: "talend_components_generate_template",
  } as const,

  CONTEXTS: {
    LIST_PROJECT: "talend_list_project_contexts",
    LIST_REPOSITORY: "talend_list_repository_contexts",
    READ: "talend_read_contexts",
    READ_REPOSITORY: "talend_read_repository_context",
    CREATE_REPOSITORY: "talend_create_repository_context",
    DELETE_REPOSITORY: "talend_delete_repository_context",
    DELETE_REPOSITORY_PARAM: "talend_delete_repository_context_parameter",
    UPSERT_REPOSITORY_PARAM: "talend_upsert_repository_context_parameter",
    PROFILE_LIST: "talend_context_profile_list",
    PROFILE_GET: "talend_context_profile_get",
    PROFILE_APPLY_TO_JOB: "talend_context_profile_apply_to_job",
    UPDATE: "talend_update_context",
    UPSERT: "talend_upsert_context",
    DELETE: "talend_delete_context",
  } as const,

  EVIDENCE: {
    PACK_BUILD: "talend_evidence_pack_build",
    PACK_EXPORT: "talend_evidence_pack_export",
  } as const,

  REPORT: {
    SNIPPETS_LIST: "talend_report_snippets_list",
    SNIPPETS_GENERATE: "talend_report_snippets_generate",
  } as const,

  REQUIREMENTS: {
    ANALYZE: "talend_task_analyze_requirements",
    BUILD_CHECKLIST: "talend_task_build_execution_plan",
    EXTRACT_RESPONSIBILITIES: "talend_task_extract_talend_responsibilities",
  } as const,

  APP_SESSION: {
    CREATE: "talend_app_session_create",
    GET: "talend_app_session_get",
    UPDATE: "talend_app_session_update",
    CLEAR: "talend_app_session_clear",
  } as const,

  COVERAGE: {
    REPORT: "talend_coverage_report",
  } as const,

  DIAGNOSE: {
    JOB: "talend_diagnose_job",
    ENVIRONMENT: "talend_diagnose_environment",
    CAN_READ_PROJECT: "talend_can_read_project",
    CAN_READ_PROCESS: "talend_can_read_process",
    CAN_READ_METADATA: "talend_can_read_metadata",
  } as const,

  STUDIO: {
    DETECT_OPEN_JOBS: "talend_detect_open_jobs",
    SUMMARIZE_OPEN_JOB: "talend_summarize_open_job",
    PROCESS: "talend_studio_process",
    LIST_OPEN_EDITORS: "talend_list_open_editors",
    PROBABLE_ACTIVE_JOB: "talend_get_probable_active_job",
  } as const,
} as const;

export type ToolName = (typeof TOOL_NAMES)[keyof typeof TOOL_NAMES][keyof (typeof TOOL_NAMES)[keyof typeof TOOL_NAMES]];
