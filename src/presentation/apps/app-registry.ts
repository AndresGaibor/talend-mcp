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

const APP_MIME_TYPE = "text/html";
const APP_RESOURCE_PREFIX = "ui://talend";

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

const PRESENTATION_APP_DEFINITIONS: PresentationAppDefinition[] = [
  {
    id: "dashboard",
    title: "Talend Dashboard",
    description: "Resumen visual del proyecto, actividad reciente y accesos rápidos.",
    resourceUri: "ui://talend/dashboard.html",
    launcherToolName: "talend_app_dashboard",
    launchMessage: "Abriendo el dashboard de Talend.",
    actions: [
      createNoInputAction("List jobs", "talend_list_jobs", "Lista los jobs disponibles."),
      createNoInputAction("Latest run log", "talend_read_latest_run_log", "Resume la última ejecución."),
      createNoInputAction("Analyze logs", "talend_analyze_logs", "Analiza logs y errores recientes."),
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
      createTextAction("Read job", "talend_read_job", "Lee el job para inspeccionar su contenido.", "jobName", { inputLabel: "Job name", inputPlaceholder: "myJob" }),
      createTextAction("List components", "talend_list_components", "Lista los componentes del job.", "jobName", { inputLabel: "Job name", inputPlaceholder: "myJob" }),
      createTextAction("Analyze tDBOutput", "talend_analyze_tdboutput", "Analiza salidas a bases de datos.", "jobName", { inputLabel: "Job name", inputPlaceholder: "myJob" }),
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
      createTextAction("Full analysis", "talend_full_analysis", "Ejecuta un análisis completo.", "jobName", { inputLabel: "Job name", inputPlaceholder: "myJob" }),
      createTextAction("Analyze logs", "talend_analyze_logs", "Analiza logs del job.", "jobName", { inputLabel: "Job name", inputPlaceholder: "myJob" }),
      createTextAction("Read job errors", "talend_read_job_errors", "Busca errores históricos.", "jobName", { inputLabel: "Job name", inputPlaceholder: "myJob" }),
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
      createTextAction("Latest run log", "talend_read_latest_run_log", "Resume la última ejecución.", "jobName", { inputLabel: "Job name", inputPlaceholder: "myJob" }),
      createTextAction("View logs", "talend_view_logs", "Muestra el log del job.", "jobName", { inputLabel: "Job name", inputPlaceholder: "myJob" }),
      createTextAction("Analyze logs", "talend_analyze_logs", "Analiza logs y sugiere acciones.", "jobName", { inputLabel: "Job name", inputPlaceholder: "myJob" }),
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
      createNoInputAction("Detect open job", "talend_detect_open_job", "Detecta el job abierto."),
      createTextAction("Read job", "talend_read_job", "Lee el job para comparar cambios.", "jobName", { inputLabel: "Job name", inputPlaceholder: "myJob" }),
      createNoInputAction("Summarize open job", "talend_summarize_open_job", "Resume el job abierto."),
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
      createTextAction("Read analysis", "talend_read_analysis", "Lee un análisis de Data Profiling.", "analysisName", { inputLabel: "Analysis name", inputPlaceholder: "myAnalysis" }),
      createTextAction("Update analysis", "talend_update_analysis", "Actualiza metadata del análisis.", "analysisName", { inputLabel: "Analysis name", inputPlaceholder: "myAnalysis" }),
      createTextAction("Duplicate analysis", "talend_duplicate_analysis", "Duplica un análisis.", "sourceAnalysisName", { inputLabel: "Source analysis name", inputPlaceholder: "myAnalysis" }),
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
      createTextAction("Inspect component", "talend_inspect_component", "Inspecciona un componente.", "uniqueName", { inputLabel: "Unique name", inputPlaceholder: "tMysqlInput_1" }),
      createTextAction("Inspect job", "talend_inspect_job", "Inspecciona el job completo.", "jobName", { inputLabel: "Job name", inputPlaceholder: "myJob" }),
      createTextAction("List components", "talend_list_components", "Lista los componentes del job.", "jobName", { inputLabel: "Job name", inputPlaceholder: "myJob" }),
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
      createNoInputAction("List jobs", "talend_list_jobs", "Lista los jobs del proyecto."),
      createNoInputAction("List project contexts", "talend_list_project_contexts", "Lista contextos del proyecto."),
      createNoInputAction("Detect open job", "talend_detect_open_job", "Detecta el job abierto."),
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
      createNoInputAction("List jobs", "talend_list_jobs", "Lista los jobs del proyecto."),
      createNoInputAction("Latest run log", "talend_read_latest_run_log", "Resume la última ejecución."),
      createNoInputAction("Analyze logs", "talend_analyze_logs", "Analiza los logs recientes."),
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
      createNoInputAction("Detect process", "talend_detect_open_job", "Detecta el trabajo abierto."),
      createNoInputAction("List jobs", "talend_list_jobs", "Lista los jobs disponibles."),
      createNoInputAction("Read job errors", "talend_read_job_errors", "Busca errores históricos."),
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
      createNoInputAction("Detect open job", "talend_detect_open_job", "Detecta el job abierto."),
      createTextAction("Read job", "talend_read_job", "Lee un job por nombre.", "jobName", { inputLabel: "Job name", inputPlaceholder: "myJob" }),
      createNoInputAction("Show flow", "talend_show_flow", "Muestra el flujo del job abierto."),
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
      createTextAction("Inspect job", "talend_inspect_job", "Inspecciona un job como patrón.", "jobName", { inputLabel: "Job name", inputPlaceholder: "myJob" }),
      createTextAction("Inspect component", "talend_inspect_component", "Inspecciona un componente.", "uniqueName", { inputLabel: "Unique name", inputPlaceholder: "tMysqlInput_1" }),
      createNoInputAction("Analyze tDBOutput", "talend_analyze_tdboutput", "Analiza salidas a base de datos."),
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
      createTextAction("Create job", "talend_create_job", "Crea un job nuevo.", "jobName", { inputLabel: "Job name", inputPlaceholder: "new_job" }),
      createTextAction("Patch component", "talend_patch_component", "Parchea propiedades de un componente.", "uniqueName", { inputLabel: "Unique name", inputPlaceholder: "tMysqlInput_1" }),
      createTextAction("Add connection", "talend_add_connection", "Agrega una conexión.", "sourceUniqueName", { inputLabel: "Source unique name", inputPlaceholder: "tInput_1" }),
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
      createJsonAction("Create job", "talend_create_job", "Crea un job desde una spec.", { jobName: "new_job" }),
      createTextAction("Update job metadata", "talend_update_job_metadata", "Actualiza metadata del job.", "jobName", { inputLabel: "Job name", inputPlaceholder: "myJob" }),
      createTextAction("Read job", "talend_read_job", "Lee un job existente.", "jobName", { inputLabel: "Job name", inputPlaceholder: "myJob" }),
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
      createTextAction("Inspect component", "talend_inspect_component", "Inspecciona un componente.", "uniqueName", { inputLabel: "Unique name", inputPlaceholder: "tMap_1" }),
      createTextAction("Update schema column", "talend_update_schema_column", "Actualiza una columna de schema.", "uniqueName", { inputLabel: "Unique name", inputPlaceholder: "tMap_1" }),
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
      createTextAction("Inspect component", "talend_inspect_component", "Inspecciona un componente.", "uniqueName", { inputLabel: "Unique name", inputPlaceholder: "tMap_1" }),
      createTextAction("Preview schema column", "talend_preview_schema_column", "Previsualiza un cambio de schema.", "uniqueName", { inputLabel: "Unique name", inputPlaceholder: "tMap_1" }),
      createTextAction("Patch component", "talend_patch_component", "Aplica un patch al componente.", "uniqueName", { inputLabel: "Unique name", inputPlaceholder: "tMap_1" }),
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
      createTextAction("View logs", "talend_view_logs", "Muestra logs de un job.", "jobName", { inputLabel: "Job name", inputPlaceholder: "myJob" }),
      createNoInputAction("Analyze tDBOutput", "talend_analyze_tdboutput", "Analiza outputs a base de datos."),
      createTextAction("Read job", "talend_read_job", "Lee el job asociado.", "jobName", { inputLabel: "Job name", inputPlaceholder: "myJob" }),
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
      createTextAction("View logs", "talend_view_logs", "Muestra logs de un job.", "jobName", { inputLabel: "Job name", inputPlaceholder: "myJob" }),
      createNoInputAction("Analyze tDBOutput", "talend_analyze_tdboutput", "Analiza outputs a base de datos."),
      createTextAction("Read job", "talend_read_job", "Lee el job asociado.", "jobName", { inputLabel: "Job name", inputPlaceholder: "myJob" }),
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
      createTextAction("Preview schema column", "talend_preview_schema_column", "Previsualiza una columna de schema.", "uniqueName", { inputLabel: "Unique name", inputPlaceholder: "tMap_1" }),
      createTextAction("Read job", "talend_read_job", "Lee el job asociado.", "jobName", { inputLabel: "Job name", inputPlaceholder: "myJob" }),
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
      createTextAction("Read contexts", "talend_read_contexts", "Lee contextos del job.", "jobName", { inputLabel: "Job name", inputPlaceholder: "myJob" }),
      createTextAction("Update context", "talend_update_context", "Actualiza un parámetro de contexto.", "contextName", { inputLabel: "Context name", inputPlaceholder: "Default" }),
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
      createTextAction("Add connection", "talend_add_connection", "Agrega una conexión entre componentes.", "sourceUniqueName", { inputLabel: "Source unique name", inputPlaceholder: "tInput_1" }),
      createTextAction("Safe add connection", "talend_safe_add_connection", "Agrega una conexión de forma segura.", "sourceUniqueName", { inputLabel: "Source unique name", inputPlaceholder: "tInput_1" }),
      createTextAction("Update schema column", "talend_update_schema_column", "Actualiza una columna de schema.", "uniqueName", { inputLabel: "Unique name", inputPlaceholder: "tMysqlOutput_1" }),
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
      createNoInputAction("Safe edit parameter", "talend_safe_edit_component_parameter", "Edita un parámetro de forma segura."),
      createNoInputAction("Safe patch component", "talend_safe_patch_component", "Aplica un patch seguro."),
      createNoInputAction("Safe add connection", "talend_safe_add_connection", "Crea una conexión segura."),
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
      createTextAction("Latest run log", "talend_read_latest_run_log", "Resume la última ejecución.", "jobName", { inputLabel: "Job name", inputPlaceholder: "myJob" }),
      createTextAction("View logs", "talend_view_logs", "Muestra el log del job.", "jobName", { inputLabel: "Job name", inputPlaceholder: "myJob" }),
      createTextAction("Analyze logs", "talend_analyze_logs", "Analiza logs del job.", "jobName", { inputLabel: "Job name", inputPlaceholder: "myJob" }),
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
      createTextAction("Latest run log", "talend_read_latest_run_log", "Resume la última ejecución.", "jobName", { inputLabel: "Job name", inputPlaceholder: "myJob" }),
      createTextAction("Read job errors", "talend_read_job_errors", "Busca errores en históricos.", "jobName", { inputLabel: "Job name", inputPlaceholder: "myJob" }),
      createNoInputAction("Detect open job", "talend_detect_open_job", "Detecta el job abierto."),
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
      createTextAction("Analyze logs", "talend_analyze_logs", "Analiza logs de la ejecución.", "jobName", { inputLabel: "Job name", inputPlaceholder: "myJob" }),
      createTextAction("View logs", "talend_view_logs", "Muestra el log del job.", "jobName", { inputLabel: "Job name", inputPlaceholder: "myJob" }),
      createTextAction("Latest run log", "talend_read_latest_run_log", "Resume la última ejecución.", "jobName", { inputLabel: "Job name", inputPlaceholder: "myJob" }),
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
      createTextAction("Read job errors", "talend_read_job_errors", "Busca errores históricos.", "jobName", { inputLabel: "Job name", inputPlaceholder: "myJob" }),
      createTextAction("Analyze logs", "talend_analyze_logs", "Analiza logs del job.", "jobName", { inputLabel: "Job name", inputPlaceholder: "myJob" }),
      createTextAction("View logs", "talend_view_logs", "Muestra el log del job.", "jobName", { inputLabel: "Job name", inputPlaceholder: "myJob" }),
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
      createTextAction("Read job errors", "talend_read_job_errors", "Busca errores históricos.", "jobName", { inputLabel: "Job name", inputPlaceholder: "myJob" }),
      createTextAction("Analyze logs", "talend_analyze_logs", "Analiza logs del job.", "jobName", { inputLabel: "Job name", inputPlaceholder: "myJob" }),
      createNoInputAction("Detect open job", "talend_detect_open_job", "Detecta el job abierto."),
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
      createTextAction("Full analysis", "talend_full_analysis", "Ejecuta un análisis completo.", "jobName", { inputLabel: "Job name", inputPlaceholder: "myJob" }),
      createTextAction("Read latest run log", "talend_read_latest_run_log", "Resume la última ejecución.", "jobName", { inputLabel: "Job name", inputPlaceholder: "myJob" }),
      createTextAction("Read job errors", "talend_read_job_errors", "Busca errores históricos.", "jobName", { inputLabel: "Job name", inputPlaceholder: "myJob" }),
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
      createNoInputAction("List jobs", "talend_list_jobs", "Lista los jobs del proyecto."),
      createNoInputAction("Detect open job", "talend_detect_open_job", "Detecta el job abierto."),
      createTextAction("Read job", "talend_read_job", "Lee un job por nombre.", "jobName", { inputLabel: "Job name", inputPlaceholder: "myJob" }),
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
      description: app.launchMessage,
      inputSchema: z.object({
        seed: z.string().optional().describe("Contexto opcional para abrir la app"),
      }),
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
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
