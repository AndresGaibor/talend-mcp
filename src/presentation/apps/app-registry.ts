import { McpServer } from "@modelcontextprotocol/server";
import type { CallToolResult } from "@modelcontextprotocol/server";
import { z } from "zod/v4";

import { createPresentationAppShellHtml } from "./app-shell";
import { buildLauncherInitialStateForApp } from "./app-state";
import {
  PRESENTATION_APP_IDS,
  type PresentationAppAction,
  type PresentationAppDefinition,
  type PresentationAppId,
  type PresentationAppLaunchResult,
} from "./app-types";

const APP_MIME_TYPE = "text/html;profile=mcp-app";

const LAUNCHER_OUTPUT_SCHEMA = z.object({
  ok: z.literal(true),
  source: z.literal("launcher"),
  confidence: z.number(),
  summary: z.string(),
  warnings: z.array(z.string()),
  app: z.object({
    id: z.string(),
    title: z.string(),
    resourceUri: z.string(),
  }),
  initialState: z.record(z.string(), z.unknown()),
  seed: z.string().optional(),
}).passthrough();

function createTextAction(
  label: string,
  toolName: string,
  description: string,
  argumentName: string,
  options?: Omit<PresentationAppAction, "label" | "toolName" | "description" | "inputMode" | "argumentName">,
): PresentationAppAction {
  return {
    label,
    toolName,
    description,
    inputMode: "text",
    argumentName,
    ...options,
  };
}

function createJsonAction(
  label: string,
  toolName: string,
  description: string,
  defaultValue: Record<string, unknown>,
  options?: Omit<PresentationAppAction, "label" | "toolName" | "description" | "inputMode" | "defaultValue">,
): PresentationAppAction {
  return {
    label,
    toolName,
    description,
    inputMode: "json",
    defaultValue: JSON.stringify(defaultValue),
    ...options,
  };
}

function createNoInputAction(label: string, toolName: string, description: string): PresentationAppAction {
  return {
    label,
    toolName,
    description,
    inputMode: "none",
  };
}

export const PRESENTATION_APP_DEFINITIONS: PresentationAppDefinition[] = [
  {
    id: "dashboard",
    title: "Talend Dashboard",
    description: "Resumen visual del proyecto, actividad reciente y accesos rápidos.",
    resourceUri: "ui://talend/dashboard.html",
    launcherToolName: "talend_app_dashboard",
    launchMessage: "Abriendo el dashboard de Talend.",
    actions: [
      createNoInputAction("Bridge ping", "talend_bridge_ping", "Verifica el bridge."),
      createNoInputAction("List jobs", "talend_list_jobs", "Lista los jobs disponibles."),
      createNoInputAction("Coverage report", "talend_coverage_report", "Muestra cobertura y gaps."),
    ],
  },
  {
    id: "dataset-inspector",
    title: "Talend Dataset Inspector",
    description: "Inspecciona datasets y revisa estructura, componentes y errores.",
    resourceUri: "ui://talend/dataset-inspector.html",
    launcherToolName: "talend_app_dataset_inspector",
    launchMessage: "Abriendo el inspector de datasets.",
    actions: [
      createTextAction("Inspect CSV folder", "talend_dataset_inspect_csv_folder", "Inspecciona una carpeta de CSVs.", "folderPath", { inputLabel: "Folder path", inputPlaceholder: "/data/csvs" }),
      createTextAction("Infer CSV schema", "talend_dataset_infer_csv_schema", "Infiere schema para una carpeta.", "folderPath", { inputLabel: "Folder path", inputPlaceholder: "/data/csvs" }),
      createTextAction("Generate raw mappings", "talend_dataset_generate_raw_table_mappings", "Genera mappings raw por archivo.", "folderPath", { inputLabel: "Folder path", inputPlaceholder: "/data/csvs" }),
    ],
  },
  {
    id: "job-designer",
    title: "Talend Job Designer",
    description: "Crea y revisa jobs con foco en diseño y estructura.",
    resourceUri: "ui://talend/job-designer.html",
    launcherToolName: "talend_app_job_designer",
    launchMessage: "Abriendo el diseñador de jobs.",
    actions: [
      createJsonAction("Create job", "talend_create_job", "Crea un job nuevo.", { jobName: "new_job" }),
      createTextAction("Read job", "talend_read_job", "Lee un job existente.", "jobName", { inputLabel: "Job name", inputPlaceholder: "myJob" }),
      createTextAction("Show flow", "talend_show_flow", "Muestra el flujo entre componentes.", "jobName", { inputLabel: "Job name", inputPlaceholder: "myJob" }),
    ],
  },
  {
    id: "validation-report",
    title: "Talend Validation Report",
    description: "Genera reportes de validación, análisis completo y logs.",
    resourceUri: "ui://talend/validation-report.html",
    launcherToolName: "talend_app_validation_report",
    launchMessage: "Abriendo el reporte de validación.",
    actions: [
      createTextAction("Validate design", "talend_job_validate_design", "Valida el diseño del job.", "jobName", { inputLabel: "Job name", inputPlaceholder: "myJob" }),
      createTextAction("Validate context usage", "talend_job_validate_context_usage", "Valida los contextos requeridos.", "jobName", { inputLabel: "Job name", inputPlaceholder: "myJob" }),
      createTextAction("Validate performance", "talend_job_validate_performance_settings", "Valida batch size y performance.", "jobName", { inputLabel: "Job name", inputPlaceholder: "myJob" }),
    ],
  },
  {
    id: "run-monitor",
    title: "Talend Run Monitor",
    description: "Monitorea ejecuciones, logs y resultados recientes.",
    resourceUri: "ui://talend/run-monitor.html",
    launcherToolName: "talend_app_run_monitor",
    launchMessage: "Abriendo el monitor de ejecuciones.",
    actions: [
      createTextAction("Run job", "talend_job_run_by_name", "Ejecuta un job por launch config.", "jobName", { inputLabel: "Job name", inputPlaceholder: "myJob", requiresConfirmation: true }),
      createTextAction("Wait run", "talend_job_wait_run", "Espera a que termine una ejecución.", "launchId", { inputLabel: "Launch id", inputPlaceholder: "launch_123", requiresConfirmation: true }),
      createTextAction("Measure runtime", "talend_job_measure_runtime", "Mide el runtime de un job.", "jobName", { inputLabel: "Job name", inputPlaceholder: "myJob" }),
    ],
  },
  {
    id: "snapshot-diff",
    title: "Talend Snapshot Diff",
    description: "Compara cambios del workspace y revisa diferencias recientes.",
    resourceUri: "ui://talend/snapshot-diff.html",
    launcherToolName: "talend_app_snapshot_diff",
    launchMessage: "Abriendo la vista de diff de snapshots.",
    actions: [
      createNoInputAction("List snapshots", "talend_snapshot_list", "Lista snapshots disponibles."),
      createTextAction("Read snapshot", "talend_snapshot_read", "Lee un snapshot.", "snapshotId", { inputLabel: "Snapshot id", inputPlaceholder: "snapshot_001" }),
      createTextAction("Diff snapshot", "talend_snapshot_diff", "Compara un snapshot con el estado actual.", "snapshotId", { inputLabel: "Snapshot id", inputPlaceholder: "snapshot_001" }),
    ],
  },
  {
    id: "deliverables",
    title: "Talend Deliverables",
    description: "Prepara salidas, análisis y artefactos para entrega.",
    resourceUri: "ui://talend/deliverables.html",
    launcherToolName: "talend_app_deliverables",
    launchMessage: "Abriendo la vista de entregables.",
    actions: [
      createTextAction("Export deliverable", "talend_deliverable_export_job", "Prepara un paquete de entregable.", "jobName", { inputLabel: "Job name", inputPlaceholder: "myJob", requiresConfirmation: true }),
      createTextAction("Collect files", "talend_deliverable_collect_files", "Recolecta archivos asociados.", "jobName", { inputLabel: "Job name", inputPlaceholder: "myJob" }),
      createTextAction("Validate checklist", "talend_deliverable_validate_checklist", "Valida requisitos de entregable.", "jobName", { inputLabel: "Job name", inputPlaceholder: "myJob" }),
    ],
  },
  {
    id: "component-catalog",
    title: "Talend Component Catalog",
    description: "Catálogo visual para inspeccionar componentes y sus capacidades.",
    resourceUri: "ui://talend/component-catalog.html",
    launcherToolName: "talend_app_component_catalog",
    launchMessage: "Abriendo el catálogo de componentes.",
    actions: [
      createTextAction("Scan installed", "talend_components_scan_installed", "Escanea componentes instalados.", "folderPath", { inputLabel: "Folder path", inputPlaceholder: "/opt/talend" }),
      createTextAction("Search component", "talend_components_search", "Busca componentes en el catálogo.", "query", { inputLabel: "Query", inputPlaceholder: "mysql" }),
      createTextAction("Inspect component", "talend_components_inspect", "Inspecciona un componente.", "componentName", { inputLabel: "Component name", inputPlaceholder: "tMysqlInput" }),
    ],
  },
  {
    id: "command-center",
    title: "Talend Command Center",
    description: "Centro de mando para navegar jobs, logs y contextos.",
    resourceUri: "ui://talend/command-center.html",
    launcherToolName: "talend_app_command_center",
    launchMessage: "Abriendo el centro de comando.",
    actions: [
      createNoInputAction("Bridge commands", "talend_bridge_commands", "Lista comandos del bridge."),
      createNoInputAction("Launch configs", "talend_bridge_launch_configs", "Lista launch configs."),
      createNoInputAction("Recent events", "talend_bridge_events_recent", "Muestra eventos recientes."),
    ],
  },
  {
    id: "home",
    title: "Talend Home",
    description: "Vista inicial con estado del entorno, actividad reciente y accesos rápidos.",
    resourceUri: "ui://talend/home.html",
    launcherToolName: "talend_app_home",
    launchMessage: "Abriendo la pantalla de inicio.",
    actions: [
      createNoInputAction("Bridge ping", "talend_bridge_ping", "Verifica el bridge."),
      createNoInputAction("List jobs", "talend_list_jobs", "Lista los jobs del proyecto."),
      createNoInputAction("Coverage report", "talend_coverage_report", "Muestra cobertura y gaps."),
    ],
  },
  {
    id: "environment-doctor",
    title: "Talend Environment Doctor",
    description: "Diagnóstico del entorno, salud del workspace y señales de riesgo.",
    resourceUri: "ui://talend/environment-doctor.html",
    launcherToolName: "talend_app_environment_doctor",
    launchMessage: "Abriendo el diagnóstico del entorno.",
    actions: [
      createNoInputAction("Studio process", "talend_studio_process", "Detecta el proceso de Talend Studio."),
      createNoInputAction("Bridge audit", "talend_bridge_audit_environment", "Audita el entorno de Studio."),
      createNoInputAction("Error stats", "talend_error_stats", "Muestra estadísticas de errores."),
    ],
  },
  {
    id: "workspace-explorer",
    title: "Talend Workspace Explorer",
    description: "Explora el workspace, el workbench y el job activo.",
    resourceUri: "ui://talend/workspace-explorer.html",
    launcherToolName: "talend_app_workspace_explorer",
    launchMessage: "Abriendo el explorador de workspace.",
    actions: [
      createNoInputAction("Workbench state", "talend_bridge_workbench_state", "Obtiene el estado del workbench."),
      createNoInputAction("Active job", "talend_get_probable_active_job", "Detecta el job activo probable."),
      createNoInputAction("Open editors", "talend_list_open_editors", "Lista editores abiertos."),
    ],
  },
  {
    id: "job-browser",
    title: "Talend Job Browser",
    description: "Navegador para jobs, contexto y actividad reciente.",
    resourceUri: "ui://talend/job-browser.html",
    launcherToolName: "talend_app_job_browser",
    launchMessage: "Abriendo el navegador de jobs.",
    actions: [
      createNoInputAction("List jobs", "talend_list_jobs", "Lista los jobs disponibles."),
      createTextAction("Read job", "talend_read_job", "Lee un job por nombre.", "jobName", { inputLabel: "Job name", inputPlaceholder: "myJob" }),
      createNoInputAction("Read contexts", "talend_read_contexts", "Lee los contextos del job abierto."),
    ],
  },
  {
    id: "pattern-gallery",
    title: "Talend Pattern Gallery",
    description: "Galería de patrones de diseño y composición de jobs.",
    resourceUri: "ui://talend/pattern-gallery.html",
    launcherToolName: "talend_app_pattern_gallery",
    launchMessage: "Abriendo la galería de patrones.",
    actions: [
      createTextAction("Validate job design", "talend_job_validate_design", "Valida el diseño del job.", "jobName", { inputLabel: "Job name", inputPlaceholder: "myJob" }),
      createTextAction("Generate job", "talend_job_generate_from_pipeline_spec", "Genera job desde spec.", "jobName", { inputLabel: "Job name", inputPlaceholder: "myJob", requiresConfirmation: true }),
      createTextAction("Preview pipeline", "talend_job_preview_pipeline_spec", "Previsualiza una spec.", "jobName", { inputLabel: "Job name", inputPlaceholder: "myJob" }),
    ],
  },
  {
    id: "visual-job-designer",
    title: "Talend Visual Job Designer",
    description: "Diseñador visual para estructuras, nodos y conexiones.",
    resourceUri: "ui://talend/visual-job-designer.html",
    launcherToolName: "talend_app_visual_job_designer",
    launchMessage: "Abriendo el diseñador visual.",
    actions: [
      createTextAction("Create job", "talend_create_job", "Crea un job nuevo.", "jobName", { inputLabel: "Job name", inputPlaceholder: "new_job", requiresConfirmation: true }),
      createTextAction("Patch component", "talend_patch_component", "Parchea propiedades de un componente.", "uniqueName", { inputLabel: "Unique name", inputPlaceholder: "tMysqlInput_1", requiresConfirmation: true }),
      createTextAction("Add connection", "talend_add_connection", "Agrega una conexión.", "sourceUniqueName", { inputLabel: "Source unique name", inputPlaceholder: "tInput_1", requiresConfirmation: true }),
    ],
  },
  {
    id: "pipeline-spec-editor",
    title: "Talend Pipeline Spec Editor",
    description: "Editor de especificaciones para jobs y pipelines generados.",
    resourceUri: "ui://talend/pipeline-spec-editor.html",
    launcherToolName: "talend_app_pipeline_spec_editor",
    launchMessage: "Abriendo el editor de pipeline spec.",
    actions: [
      createJsonAction("Validate spec", "talend_job_validate_pipeline_spec", "Valida una spec de pipeline.", { pattern: "multi_csv_raw_loader", jobName: "new_job" }),
      createJsonAction("Preview spec", "talend_job_preview_pipeline_spec", "Previsualiza una spec de pipeline.", { pattern: "multi_csv_raw_loader", jobName: "new_job" }),
      createJsonAction("Generate job", "talend_job_generate_from_pipeline_spec", "Genera un job desde la spec.", { pattern: "multi_csv_raw_loader", jobName: "new_job" }, { requiresConfirmation: true }),
    ],
  },
  {
    id: "mapping-builder",
    title: "Talend Mapping Builder",
    description: "Construye mappings y analiza componentes tMap/tDBOutput.",
    resourceUri: "ui://talend/mapping-builder.html",
    launcherToolName: "talend_app_mapping_builder",
    launchMessage: "Abriendo el builder de mappings.",
    actions: [
      createNoInputAction("Analyze tDBOutput", "talend_analyze_tdboutput", "Analiza salidas de base de datos."),
      createTextAction("Inspect component", "talend_components_inspect", "Inspecciona un componente.", "componentName", { inputLabel: "Component name", inputPlaceholder: "tMap" }),
      createTextAction("Generate template", "talend_components_generate_template", "Genera plantilla para un componente.", "componentName", { inputLabel: "Component name", inputPlaceholder: "tMap" }),
    ],
  },
  {
    id: "tmap-designer",
    title: "Talend tMap Designer",
    description: "Diseñador centrado en mapeos, schemas y conexiones.",
    resourceUri: "ui://talend/tmap-designer.html",
    launcherToolName: "talend_app_tmap_designer",
    launchMessage: "Abriendo el diseñador de tMap.",
    actions: [
      createTextAction("Inspect component", "talend_components_inspect", "Inspecciona un componente.", "componentName", { inputLabel: "Component name", inputPlaceholder: "tMap" }),
      createTextAction("Preview schema", "talend_preview_schema_column", "Previsualiza un cambio de schema.", "columnName", { inputLabel: "Column name", inputPlaceholder: "id" }),
      createTextAction("Patch component", "talend_patch_component", "Aplica un patch al componente.", "uniqueName", { inputLabel: "Unique name", inputPlaceholder: "tMap_1", requiresConfirmation: true }),
    ],
  },
  {
    id: "dataset-inspector-pro",
    title: "Talend Dataset Inspector Pro",
    description: "Inspección avanzada de datasets, tablas raw y esquemas.",
    resourceUri: "ui://talend/dataset-inspector-pro.html",
    launcherToolName: "talend_app_dataset_inspector_pro",
    launchMessage: "Abriendo el inspector pro de datasets.",
    actions: [
      createTextAction("Inspect CSV folder", "talend_dataset_inspect_csv_folder", "Inspecciona CSVs.", "folderPath", { inputLabel: "Folder path", inputPlaceholder: "/data/csvs" }),
      createTextAction("Infer CSV schema", "talend_dataset_infer_csv_schema", "Infiere el schema de CSVs.", "folderPath", { inputLabel: "Folder path", inputPlaceholder: "/data/csvs" }),
      createTextAction("Generate raw mappings", "talend_dataset_generate_raw_table_mappings", "Genera mappings raw.", "folderPath", { inputLabel: "Folder path", inputPlaceholder: "/data/csvs" }),
    ],
  },
  {
    id: "csv-preview",
    title: "Talend CSV Preview",
    description: "Vista rápida de CSVs, delimitadores y encabezados.",
    resourceUri: "ui://talend/csv-preview.html",
    launcherToolName: "talend_app_csv_preview",
    launchMessage: "Abriendo la vista previa de CSV.",
    actions: [
      createTextAction("Inspect CSV folder", "talend_dataset_inspect_csv_folder", "Inspecciona CSVs.", "folderPath", { inputLabel: "Folder path", inputPlaceholder: "/data/csvs" }),
      createTextAction("Generate raw mappings", "talend_dataset_generate_raw_table_mappings", "Genera mappings raw.", "folderPath", { inputLabel: "Folder path", inputPlaceholder: "/data/csvs" }),
      createTextAction("Infer CSV schema", "talend_dataset_infer_csv_schema", "Infiere schema para raw tables.", "folderPath", { inputLabel: "Folder path", inputPlaceholder: "/data/csvs" }),
    ],
  },
  {
    id: "raw-mapping-matrix",
    title: "Talend Raw Mapping Matrix",
    description: "Matriz de mapeos raw para columnas técnicas y datasets.",
    resourceUri: "ui://talend/raw-mapping-matrix.html",
    launcherToolName: "talend_app_raw_mapping_matrix",
    launchMessage: "Abriendo la matriz de mappings raw.",
    actions: [
      createNoInputAction("Analyze tDBOutput", "talend_analyze_tdboutput", "Analiza salidas a base de datos."),
      createTextAction("Preview pipeline", "talend_job_preview_pipeline_spec", "Previsualiza la spec.", "jobName", { inputLabel: "Job name", inputPlaceholder: "myJob" }),
      createTextAction("Generate raw mappings", "talend_dataset_generate_raw_table_mappings", "Genera mappings raw.", "folderPath", { inputLabel: "Folder path", inputPlaceholder: "/data/csvs" }),
    ],
  },
  {
    id: "context-profiles",
    title: "Talend Context Profiles",
    description: "Gestiona perfiles de contexto, variables y cambios asociados.",
    resourceUri: "ui://talend/context-profiles.html",
    launcherToolName: "talend_app_context_profiles",
    launchMessage: "Abriendo los perfiles de contexto.",
    actions: [
      createNoInputAction("List project contexts", "talend_list_project_contexts", "Lista contextos del proyecto."),
      createNoInputAction("List context profiles", "talend_context_profile_list", "Lista perfiles de contexto."),
      createTextAction("Get profile", "talend_context_profile_get", "Obtiene un perfil de contexto.", "profileName", { inputLabel: "Profile name", inputPlaceholder: "Default" }),
      createJsonAction("Apply to job", "talend_context_profile_apply_to_job", "Aplica un perfil a una spec de job.", { profileName: "Default", jobSpec: {} }),
    ],
  },
  {
    id: "database-connection-wizard",
    title: "Talend Database Connection Wizard",
    description: "Asistente para conexiones a bases de datos y componentes disponibles.",
    resourceUri: "ui://talend/database-connection-wizard.html",
    launcherToolName: "talend_app_database_connection_wizard",
    launchMessage: "Abriendo el asistente de conexión a base de datos.",
    actions: [
      createTextAction("Build connection profile", "talend_connection_build_profile", "Construye un perfil de conexión.", "connectionType", { inputLabel: "Connection type", inputPlaceholder: "postgresql" }),
      createTextAction("Add connection", "talend_add_connection", "Agrega una conexión entre componentes.", "sourceUniqueName", { inputLabel: "Source unique name", inputPlaceholder: "tInput_1", requiresConfirmation: true }),
      createTextAction("Update schema column", "talend_update_schema_column", "Actualiza una columna de schema.", "uniqueName", { inputLabel: "Unique name", inputPlaceholder: "tMysqlOutput_1", requiresConfirmation: true }),
    ],
  },
  {
    id: "secret-safety",
    title: "Talend Secret Safety",
    description: "Revisa secretos, contexto y operaciones seguras.",
    resourceUri: "ui://talend/secret-safety.html",
    launcherToolName: "talend_app_secret_safety",
    launchMessage: "Abriendo la vista de seguridad de secretos.",
    actions: [
      createTextAction("Explain error", "talend_error_explain", "Explica un mensaje de error.", "errorMessage", { inputLabel: "Error message", inputPlaceholder: "NullPointerException" }),
      createTextAction("Error stats", "talend_error_stats", "Muestra estadísticas de errores.", "errorMessage", { inputLabel: "Error message", inputPlaceholder: "NullPointerException" }),
      createTextAction("Suggest fix", "talend_error_suggest_fix", "Sugiere un fix para un error.", "errorMessage", { inputLabel: "Error message", inputPlaceholder: "NullPointerException" }),
    ],
  },
  {
    id: "run-monitor-pro",
    title: "Talend Run Monitor Pro",
    description: "Monitor avanzado para ejecuciones, logs y comparaciones.",
    resourceUri: "ui://talend/run-monitor-pro.html",
    launcherToolName: "talend_app_run_monitor_pro",
    launchMessage: "Abriendo el monitor pro de ejecuciones.",
    actions: [
      createTextAction("Run job", "talend_job_run_by_name", "Ejecuta un job.", "jobName", { inputLabel: "Job name", inputPlaceholder: "myJob", requiresConfirmation: true }),
      createTextAction("Wait run", "talend_job_wait_run", "Espera una ejecución.", "launchId", { inputLabel: "Launch id", inputPlaceholder: "launch_123" }),
      createTextAction("Measure runtime", "talend_job_measure_runtime", "Mide runtime.", "jobName", { inputLabel: "Job name", inputPlaceholder: "myJob" }),
    ],
  },
  {
    id: "launch-history",
    title: "Talend Launch History",
    description: "Historial de lanzamientos y ejecuciones recientes.",
    resourceUri: "ui://talend/launch-history.html",
    launcherToolName: "talend_app_launch_history",
    launchMessage: "Abriendo el historial de lanzamientos.",
    actions: [
      createNoInputAction("List runs", "talend_list_runs", "Lista runs recientes."),
      createTextAction("Read run", "talend_read_run", "Lee un run por id.", "runId", { inputLabel: "Run id", inputPlaceholder: "run_123" }),
      createTextAction("Tail output", "talend_tail_run_output", "Lee el stdout/stderr de un run.", "runId", { inputLabel: "Run id", inputPlaceholder: "run_123" }),
    ],
  },
  {
    id: "runtime-comparison",
    title: "Talend Runtime Comparison",
    description: "Comparador de ejecuciones, logs y artefactos recientes.",
    resourceUri: "ui://talend/runtime-comparison.html",
    launcherToolName: "talend_app_runtime_comparison",
    launchMessage: "Abriendo la comparación de runtimes.",
    actions: [
      createNoInputAction("List runs", "talend_list_runs", "Lista runs recientes."),
      createTextAction("Read run", "talend_read_run", "Lee un run por id.", "runId", { inputLabel: "Run id", inputPlaceholder: "run_123" }),
      createTextAction("Measure runtime", "talend_job_measure_runtime", "Mide runtime.", "jobName", { inputLabel: "Job name", inputPlaceholder: "myJob" }),
    ],
  },
  {
    id: "problems-view",
    title: "Talend Problems View",
    description: "Vista de problemas y errores para revisar fallos rápido.",
    resourceUri: "ui://talend/problems-view.html",
    launcherToolName: "talend_app_problems_view",
    launchMessage: "Abriendo la vista de problemas.",
    actions: [
      createNoInputAction("Error stats", "talend_error_stats", "Muestra estadísticas de errores."),
      createTextAction("Explain error", "talend_error_explain", "Explica un error.", "errorMessage", { inputLabel: "Error message", inputPlaceholder: "NullPointerException" }),
      createTextAction("Suggest fix", "talend_error_suggest_fix", "Sugiere un fix.", "errorMessage", { inputLabel: "Error message", inputPlaceholder: "NullPointerException" }),
    ],
  },
  {
    id: "error-explorer",
    title: "Talend Error Explorer",
    description: "Explorador de errores con foco en patrones y trazas recientes.",
    resourceUri: "ui://talend/error-explorer.html",
    launcherToolName: "talend_app_error_explorer",
    launchMessage: "Abriendo el explorador de errores.",
    actions: [
      createTextAction("Explain error", "talend_error_explain", "Explica un error.", "errorMessage", { inputLabel: "Error message", inputPlaceholder: "NullPointerException" }),
      createTextAction("Suggest fix", "talend_error_suggest_fix", "Sugiere un fix.", "errorMessage", { inputLabel: "Error message", inputPlaceholder: "NullPointerException" }),
      createNoInputAction("Error stats", "talend_error_stats", "Muestra estadísticas de errores."),
    ],
  },
  {
    id: "validation-timeline",
    title: "Talend Validation Timeline",
    description: "Línea de tiempo de validaciones, errores y ejecuciones.",
    resourceUri: "ui://talend/validation-timeline.html",
    launcherToolName: "talend_app_validation_timeline",
    launchMessage: "Abriendo la línea de tiempo de validación.",
    actions: [
      createTextAction("Validate design", "talend_job_validate_design", "Valida el diseño.", "jobName", { inputLabel: "Job name", inputPlaceholder: "myJob" }),
      createTextAction("Validate contexts", "talend_job_validate_context_usage", "Valida contextos.", "jobName", { inputLabel: "Job name", inputPlaceholder: "myJob" }),
      createTextAction("Validate audit", "talend_job_validate_audit_columns", "Valida audit columns.", "jobName", { inputLabel: "Job name", inputPlaceholder: "myJob" }),
    ],
  },
  {
    id: "snapshot-manager",
    title: "Talend Snapshot Manager",
    description: "Administrador de snapshots, cambios y actividad reciente.",
    resourceUri: "ui://talend/snapshot-manager.html",
    launcherToolName: "talend_app_snapshot_manager",
    launchMessage: "Abriendo el gestor de snapshots.",
    actions: [
      createNoInputAction("List snapshots", "talend_snapshot_list", "Lista snapshots disponibles."),
      createTextAction("Read snapshot", "talend_snapshot_read", "Lee un snapshot.", "snapshotId", { inputLabel: "Snapshot id", inputPlaceholder: "snapshot_001" }),
      createTextAction("Restore snapshot", "talend_snapshot_restore", "Restaura un snapshot.", "snapshotId", { inputLabel: "Snapshot id", inputPlaceholder: "snapshot_001", requiresConfirmation: true }),
    ],
  },
];

const APP_BY_ID = new Map<PresentationAppId, PresentationAppDefinition>(
  PRESENTATION_APP_DEFINITIONS.map((app) => [app.id, app]),
);

function buildLauncherToolResult(app: PresentationAppDefinition, initialState: Record<string, unknown>, seed?: string): CallToolResult {
  const warnings = Array.isArray((initialState as { warnings?: unknown }).warnings)
    ? ((initialState as { warnings?: string[] }).warnings ?? [])
    : [];

  const structuredContent: PresentationAppLaunchResult = {
    ok: true,
    source: "launcher",
    confidence: warnings.length > 0 ? 0.82 : 0.94,
    summary: app.launchMessage,
    warnings,
    app: {
      id: app.id,
      title: app.title,
      resourceUri: app.resourceUri,
    },
    initialState,
    ...(seed ? { seed } : {}),
  };

  return {
    content: [{ type: "text", text: app.launchMessage }],
    structuredContent,
  };
}

export function getPresentationAppDefinition(appId: PresentationAppId): PresentationAppDefinition {
  const app = APP_BY_ID.get(appId);
  if (!app) {
    throw new Error(`App no registrada: ${appId}`);
  }
  return app;
}

export function registerPresentationAppResources(server: McpServer): void {
  for (const app of PRESENTATION_APP_DEFINITIONS) {
    server.registerResource(app.id, app.resourceUri, {
      title: app.title,
      description: app.description,
      mimeType: APP_MIME_TYPE,
    }, async () => ({
      contents: [{ uri: app.resourceUri, mimeType: APP_MIME_TYPE, text: createPresentationAppShellHtml(app) }],
    }));
  }
}

export function registerPresentationAppLaunchers(server: McpServer): void {
  for (const app of PRESENTATION_APP_DEFINITIONS) {
    server.registerTool(app.launcherToolName, {
      title: app.title,
      description: app.launchMessage,
      inputSchema: z.object({
        seed: z.string().optional().describe("Contexto opcional para abrir la app"),
      }),
      outputSchema: LAUNCHER_OUTPUT_SCHEMA,
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
      },
      _meta: {
        ui: {
          resourceUri: app.resourceUri,
          visibility: ["model", "app"],
        },
        "openai/outputTemplate": app.resourceUri,
        "openai/widgetAccessible": true,
        "openai/toolInvocation/invoking": app.launchMessage,
        "openai/toolInvocation/invoked": `${app.title} lista`,
      },
    }, async (input: { seed?: string }) => {
      const initialState = await buildLauncherInitialStateForApp(app.id);
      return buildLauncherToolResult(app, initialState, input.seed);
    });
  }
}

export function registerPresentationApps(server: McpServer): void {
  registerPresentationAppResources(server);
  registerPresentationAppLaunchers(server);
}

export function listPresentationAppIds(): readonly PresentationAppId[] {
  return PRESENTATION_APP_IDS;
}
