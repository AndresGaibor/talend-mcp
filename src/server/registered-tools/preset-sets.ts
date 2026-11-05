// ─── Tool Presets ─────────────────────────────────────────────────────────────
// Available presets (TALEND_MCP_FILTER env var, comma-separated):
//
//   all          → todas las tools talend_*
//   canonical    → idem, sin los duplicados legacy conocidos
//   agent        → flujo habitual de inspeccion, creacion, edicion y ejecucion
//   portal       → agent + lectura de inspeccion y problemas que usa el migrador SAS
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
  // Interfaz canónica (Fase 2, ~20 tools): la experiencia pública del
  // agente. El resto queda en `all` a través de Code Mode
  // (talend_search/describe/execute).
  "talend_guide",
  "talend_job_inspect",
  "talend_component_describe",
  "talend_job_plan",
  "talend_job_edit",
  "talend_job_run",
  "talend_run_status",
  "talend_search",
  "talend_describe",
  "talend_execute",
  "talend_jobs_list",
  "talend_job_verify",
  "talend_read_contexts",
  "talend_job_quality_report",
  "talend_snapshots_list",
  "talend_job_build_batch",
  "talend_job_create_in_studio",
  "talend_bridge_ping",
  "talend_diagnose_environment",
  // Compatibilidad: las legacy que el portal/automación aún invocan
  // directamente siguen expuestas, pero fuera de las canónicas.
  "talend_job_add_node",
  "talend_job_configure_node",
  "talend_job_connect_nodes",
  "talend_job_execute",
  "talend_tail_run_output",
  "talend_jobs_create_from_spec",
  "talend_jobs_create_batch",
  "talend_job_edit_offline",
]);

/**
 * Preset `portal`: para un cliente que crea Jobs desde especificaciones y luego
 * los inspecciona. Es `PRESET_AGENT` más las tools de lectura de inspección,
 * problemas de Studio y verificación de componentes. `agent` sigue sin
 * `talend_job_problems`: la decisión de ocultarla allí es deliberada.
 */
export const PRESET_PORTAL = new Set([
  ...PRESET_AGENT,
  // Lectura del contrato del portal (`contract/portal-tools.json`).
  "talend_inspect_component",
  "talend_inspect_job",
  "talend_job_info",
  "talend_job_problems",
  "talend_list_components",
  "talend_component_icon",
  "talend_preview_component_parameter",
  "talend_preview_schema_column",
  "talend_repo_sources",
  "talend_repo_status",
  "talend_analyze_tdboutput",
  // Memoria de Studio y reinicio a peticion del portal.
  "talend_studio_memory",
  "talend_studio_restart",
]);

/**
 * Nombres legacy que siguen existiendo como tool y duplican una canonica.
 * Se ocultan en el preset "canonical" para no exponer la misma capacidad dos
 * veces. Si una tool deja de existir, hay que quitarla de esta lista.
 */
export const LEGACY_TALEND_ALIASES = new Set([
  "talend_report_generate_snippets",          // → talend_report_snippets_generate
  // Nombres antiguos de las tools renombradas para evitar colisión
  // modulo↔legacy (Fase 1): el alias se mantiene en `all`, fuera de
  // `canonical`, para compatibilidad.
  "talend_task_analyze_requirements",        // → talend_requirements_analyze_project
  "talend_task_build_execution_plan",        // → talend_requirements_build_checklist
  "talend_jobs_validate_pipeline_spec",       // → talend_job_validate_pipeline_spec (legacy Studio)
  "talend_jobs_preview_pipeline_spec",        // → talend_job_preview_pipeline_spec (legacy Studio)
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
