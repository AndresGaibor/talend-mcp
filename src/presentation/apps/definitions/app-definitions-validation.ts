import type { PresentationAppDefinition } from "../app-types";
import { createJsonAction, createTextAction, createNoInputAction } from "./action-helpers";

export const VALIDATION_APP_DEFINITIONS: PresentationAppDefinition[] = [
  {
    id: "validation-report",
    title: "Talend Validation Report",
    description: "Genera reportes de validación, análisis completo y logs.",
    resourceUri: "ui://talend/validation-report.html",
    launcherToolName: "talend_app_validation_report",
    launchMessage: "Abriendo el reporte de validación.",
    uiMode: "react",
    actions: [
      createTextAction("Validate design", "talend_validation_validate_design", "Valida el diseño del job.", "jobName", { inputLabel: "Job name", inputPlaceholder: "myJob" }),
      createTextAction("Validate context usage", "talend_validation_validate_context_usage", "Valida los contextos requeridos.", "jobName", { inputLabel: "Job name", inputPlaceholder: "myJob" }),
      createTextAction("Validate performance", "talend_validation_validate_performance", "Valida batch size y performance.", "jobName", { inputLabel: "Job name", inputPlaceholder: "myJob" }),
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
      createNoInputAction("Error stats", "talend_errors_stats", "Muestra estadísticas de errores."),
      createTextAction("Explain error", "talend_errors_explain", "Explica un error.", "errorMessage", { inputLabel: "Error message", inputPlaceholder: "NullPointerException" }),
      createTextAction("Suggest fix", "talend_errors_suggest_fix", "Sugiere un fix.", "errorMessage", { inputLabel: "Error message", inputPlaceholder: "NullPointerException" }),
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
      createTextAction("Explain error", "talend_errors_explain", "Explica un error.", "errorMessage", { inputLabel: "Error message", inputPlaceholder: "NullPointerException" }),
      createTextAction("Suggest fix", "talend_errors_suggest_fix", "Sugiere un fix.", "errorMessage", { inputLabel: "Error message", inputPlaceholder: "NullPointerException" }),
      createNoInputAction("Error stats", "talend_errors_stats", "Muestra estadísticas de errores."),
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
      createTextAction("Validate design", "talend_validation_validate_design", "Valida el diseño.", "jobName", { inputLabel: "Job name", inputPlaceholder: "myJob" }),
      createTextAction("Validate contexts", "talend_validation_validate_context_usage", "Valida contextos.", "jobName", { inputLabel: "Job name", inputPlaceholder: "myJob" }),
      createTextAction("Validate audit", "talend_validation_validate_audit_columns", "Valida audit columns.", "jobName", { inputLabel: "Job name", inputPlaceholder: "myJob" }),
    ],
  },
  {
    id: "environment-doctor",
    title: "Talend Environment Doctor",
    description: "Diagnóstico del entorno, salud del workspace y señales de riesgo.",
    resourceUri: "ui://talend/environment-doctor.html",
    launcherToolName: "talend_app_environment_doctor",
    launchMessage: "Abriendo el diagnóstico del entorno.",
    uiMode: "react",
    actions: [
      createNoInputAction("Studio process", "talend_studio_process", "Detecta el proceso de Talend Studio."),
      createNoInputAction("Bridge audit", "talend_bridge_audit_environment", "Audita el entorno de Studio."),
      createNoInputAction("Error stats", "talend_errors_stats", "Muestra estadísticas de errores."),
    ],
  },
];
