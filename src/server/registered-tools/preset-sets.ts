// ─── Tool Presets ─────────────────────────────────────────────────────────────
// Available presets (TALEND_MCP_FILTER env var, comma-separated):
//
//   all          → todas las tools talend_*
//   canonical    → idem, sin los duplicados legacy conocidos
//   agent        → flujo habitual de inspeccion, creacion, edicion y ejecucion
//   core         → tools esenciales (las mas seguras para clientes limitados)
//   jobs         → talend_jobs_* + tools de job relacionadas
//   snapshots    → talend_snapshots_*
//   runs         → tools de ejecucion
//   errors       → talend_errors_*
//   validation   → talend_validation_*
//   secrets      → talend_secrets_*
//   datasets     → talend_datasets_*
//   deliverables → talend_deliverables_*
//   components   → talend_components_*
//   bridge       → talend_bridge_*
//   requirements → talend_requirements_*
//   evidence     → talend_evidence_*
//   reports      → talend_report_snippets_*
//
// Presets are additive: TALEND_MCP_FILTER="core,jobs"
// Wildcards work too:  TALEND_MCP_FILTER="talend_bridge_*"

// Curated safe set: the tools a limited client needs to start (see `core` above)
export const PRESET_CORE = new Set([
  "talend_jobs_list",
  "talend_jobs_read",
  "talend_show_flow",
  "talend_read_contexts",
  "talend_detect_open_jobs",
  "talend_summarize_open_job",
  "talend_diagnose_environment",
  "talend_bridge_ping",
  "talend_runs_list",
  "talend_runs_read",
  "talend_job_run_by_name",
  "talend_list_project_contexts",
  "talend_list_repository_contexts",
  "talend_read_repository_context",
  "talend_secrets_scan_project",
  "talend_secrets_scan_job",
  "talend_validation_validate_design",
  "talend_validation_validate_context_usage",
  "talend_errors_stats",
  "talend_errors_explain",
  "talend_errors_suggest_fix",
]);

/**
 * Seleccion orientada a agentes nuevos: cubre el ciclo habitual de un job sin
 * enviar las 200+ tools especializadas en cada `tools/list`. Para las tareas
 * avanzadas, `talend_guide` avisa si el preset no expone los pasos necesarios.
 */
export const PRESET_AGENT = new Set([
  // Verificacion: `talend_job_verify` agrupa problems + compile + run; esas tools
  // sueltas siguen en `all` pero no se exponen al agente para no multiplicar decisiones.
  "talend_guide",
  "talend_diagnose_environment",
  "talend_bridge_ping",
  "talend_detect_open_jobs",
  "talend_summarize_open_job",
  "talend_jobs_list",
  "talend_jobs_read",
  "talend_show_flow",
  "talend_read_contexts",
  "talend_list_project_contexts",
  "talend_list_repository_contexts",
  "talend_read_repository_context",
  "talend_studio_list_components",
  "talend_studio_component_parameters",
  "talend_studio_ui_inventory",
  "talend_studio_ui_dialogs",
  "talend_components_definition",
  "talend_components_search",
  "talend_components_parameters",
  "talend_components_connectors",
  "talend_components_get_mapping_suggestions",
  "talend_recipe_generate",
  "talend_job_create_in_studio",
  "talend_job_open_in_studio",
  "talend_job_add_node",
  "talend_job_configure_node",
  "talend_job_update_node",
  "talend_job_set_schema",
  "talend_job_connect_nodes",
  "talend_job_list_nodes",
  "talend_job_contexts_list",
  "talend_job_context_create",
  "talend_job_context_set",
  "talend_job_verify",
  "talend_job_build_batch",
  "talend_job_edit_offline",
  "talend_jobs_create_batch",
  "talend_jobs_edit_batch",
  "talend_jobs_create_from_spec",
  "talend_job_apply_custom_spec",
  "talend_job_execute",
  "talend_runs_list",
  "talend_runs_read",
  "talend_tail_run_output",
  "talend_read_run_log",
  "talend_analyze_logs",
  "talend_bridge_log_tail",
  "talend_bridge_problems_markers",
  "talend_errors_explain",
  "talend_errors_suggest_fix",
  "talend_secrets_scan_project",
  "talend_secrets_scan_job",
  "talend_validation_validate_design",
  "talend_validation_validate_context_usage",
  "talend_job_quality_report",
  "talend_job_quality_issues",
]);

/**
 * Nombres legacy que siguen existiendo como tool y duplican una canonica.
 * Se ocultan en el preset "canonical" para no exponer la misma capacidad dos
 * veces. Si una tool deja de existir, hay que quitarla de esta lista.
 */
export const LEGACY_TALEND_ALIASES = new Set([
  "talend_report_generate_snippets",          // → talend_report_snippets_generate
]);

/** Tools de ejecucion que el preset `runs` agrupa ademas del prefijo `talend_runs_`. */
export const RUNS_TOOLS = new Set([
  "talend_tail_run_output", "talend_read_run_log", "talend_job_run_by_name",
  "talend_job_wait_run", "talend_run_exported_job", "talend_runs_collect_logs",
  "talend_runs_analyze_output",
]);

/** Tools de job que no comparten el prefijo `talend_jobs_`. */
export const JOBS_EXTRA = new Set([
  "talend_show_flow", "talend_read_contexts", "talend_detect_open_jobs",
  "talend_summarize_open_job", "talend_diagnose_environment",
  "talend_can_read_project", "talend_can_read_process", "talend_can_read_metadata",
]);
