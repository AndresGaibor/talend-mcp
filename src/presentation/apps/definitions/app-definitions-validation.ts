import type { PresentationAppDefinition } from "../app-types";
import { createJsonAction, createTextAction, createNoInputAction } from "./action-helpers";
import { TOOL_NAMES } from "../../../tools/tool-names";

export const VALIDATION_APP_DEFINITIONS: PresentationAppDefinition[] = [
  {
    id: "validation-report",
    title: "Talend Validation Report",
    description: "Reporte detallado de validación de diseño, contexto y rendimiento.",
    resourceUri: "ui://talend/validation-report.html",
    launcherToolName: "talend_app_validation_report",
    launchMessage: "Abriendo el reporte de validación.",
    uiMode: "react",
    actions: [
      createTextAction("Validate design", TOOL_NAMES.VALIDATION.VALIDATE_DESIGN, "Valida diseño del job.", "jobName", { inputLabel: "Job name", inputPlaceholder: "myJob" }),
      createTextAction("Validate context", TOOL_NAMES.VALIDATION.VALIDATE_CONTEXT_USAGE, "Valida uso de contextos.", "jobName", { inputLabel: "Job name", inputPlaceholder: "myJob" }),
      createTextAction("Validate audit columns", TOOL_NAMES.VALIDATION.VALIDATE_AUDIT_COLUMNS, "Valida columnas de auditoría.", "jobName", { inputLabel: "Job name", inputPlaceholder: "myJob" }),
      createTextAction("Validate performance", TOOL_NAMES.VALIDATION.VALIDATE_PERFORMANCE, "Valida rendimiento.", "jobName", { inputLabel: "Job name", inputPlaceholder: "myJob" }),
    ],
  },
  {
    id: "validation-timeline",
    title: "Talend Validation Timeline",
    description: "Línea de tiempo de validaciones y cambios.",
    resourceUri: "ui://talend/validation-timeline.html",
    launcherToolName: "talend_app_validation_timeline",
    launchMessage: "Abriendo la línea de tiempo de validaciones.",
    actions: [
      createNoInputAction("Validate design", TOOL_NAMES.VALIDATION.VALIDATE_DESIGN, "Valida diseño actual."),
    ],
  },
  {
    id: "error-explorer",
    title: "Talend Error Explorer",
    description: "Explora y analiza errores de jobs y ejecuciones.",
    resourceUri: "ui://talend/error-explorer.html",
    launcherToolName: "talend_app_error_explorer",
    launchMessage: "Abriendo el explorador de errores.",
    actions: [
      createNoInputAction("Error stats", TOOL_NAMES.ERRORS.STATS, "Estadísticas de errores."),
      createTextAction("Explain error", TOOL_NAMES.ERRORS.EXPLAIN, "Explica un error.", "errorMessage", { inputLabel: "Error message", inputPlaceholder: "NullPointerException" }),
      createTextAction("Suggest fix", TOOL_NAMES.ERRORS.SUGGEST_FIX, "Sugiere fix para error.", "errorMessage", { inputLabel: "Error message", inputPlaceholder: "NullPointerException" }),
    ],
  },
  {
    id: "problems-view",
    title: "Talend Problems View",
    description: "Vista centralizada de problemas, warnings y errores.",
    resourceUri: "ui://talend/problems-view.html",
    launcherToolName: "talend_app_problems_view",
    launchMessage: "Abriendo la vista de problemas.",
    uiMode: "react",
    actions: [
      createNoInputAction("Problems markers", TOOL_NAMES.BRIDGE.PROBLEMS_MARKERS, "Lista markers de problemas."),
    ],
  },
  {
    id: "snapshot-manager",
    title: "Talend Snapshot Manager",
    description: "Gestiona snapshots del proyecto con diff y restore.",
    resourceUri: "ui://talend/snapshot-manager.html",
    launcherToolName: "talend_app_snapshot_manager",
    launchMessage: "Abriendo el gestor de snapshots.",
    uiMode: "react",
    actions: [
      createNoInputAction("List snapshots", TOOL_NAMES.SNAPSHOTS.LIST, "Lista snapshots disponibles."),
      createTextAction("Read snapshot", TOOL_NAMES.SNAPSHOTS.READ, "Lee un snapshot.", "snapshotId", { inputLabel: "Snapshot ID", inputPlaceholder: "snap_001" }),
      createJsonAction("Create snapshot", TOOL_NAMES.SNAPSHOTS.CREATE, "Crea un snapshot.", { name: "before_change", sourcePath: "." }, { requiresConfirmation: true }),
      createJsonAction("Diff snapshots", TOOL_NAMES.SNAPSHOTS.DIFF, "Compara dos snapshots.", { snapshotIdA: "snap_001", snapshotIdB: "snap_002" }),
      createJsonAction("Restore snapshot", TOOL_NAMES.SNAPSHOTS.RESTORE, "Restaura un snapshot.", { snapshotId: "snap_001" }, { requiresConfirmation: true }),
    ],
  },
  {
    id: "snapshot-diff",
    title: "Talend Snapshot Diff",
    description: "Compara dos snapshots lado a lado.",
    resourceUri: "ui://talend/snapshot-diff.html",
    launcherToolName: "talend_app_snapshot_diff",
    launchMessage: "Abriendo el comparador de snapshots.",
    actions: [
      createJsonAction("Diff snapshots", TOOL_NAMES.SNAPSHOTS.DIFF, "Compara dos snapshots.", { snapshotIdA: "snap_001", snapshotIdB: "snap_002" }),
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
      createNoInputAction("Studio process", TOOL_NAMES.STUDIO.PROCESS, "Detecta el proceso de Talend Studio."),
      createNoInputAction("Bridge audit", TOOL_NAMES.BRIDGE.AUDIT_ENVIRONMENT, "Audita el entorno de Studio."),
      createNoInputAction("Error stats", TOOL_NAMES.ERRORS.STATS, "Muestra estadísticas de errores."),
    ],
  },
];
