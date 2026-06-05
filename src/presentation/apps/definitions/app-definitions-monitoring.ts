import type { PresentationAppDefinition } from "../app-types";
import { createJsonAction, createTextAction, createNoInputAction } from "./action-helpers";
import { TOOL_NAMES } from "../../../tools/tool-names";

export const MONITORING_APP_DEFINITIONS: PresentationAppDefinition[] = [
  {
    id: "run-monitor",
    title: "Talend Run Monitor",
    description: "Monitoreo de ejecuciones de jobs, logs y estado.",
    resourceUri: "ui://talend/run-monitor.html",
    launcherToolName: "talend_app_run_monitor",
    launchMessage: "Abriendo el monitor de ejecuciones.",
    uiMode: "react",
    actions: [
      createNoInputAction("List runs", TOOL_NAMES.RUNS.LIST, "Lista ejecuciones recientes."),
      createTextAction("Read run", TOOL_NAMES.RUNS.READ, "Lee detalles de una ejecución.", "runId", { inputLabel: "Run ID", inputPlaceholder: "run_001" }),
      createJsonAction("Start run", TOOL_NAMES.RUNS.START, "Inicia una ejecución de job.", { jobName: "myJob" }, { requiresConfirmation: true }),
      createJsonAction("Start exported", TOOL_NAMES.RUNS.START_EXPORTED, "Inicia ejecución exportada.", { exportedJobPath: "/path/to/job" }, { requiresConfirmation: true }),
    ],
  },
  {
    id: "run-monitor-pro",
    title: "Talend Run Monitor Pro",
    description: "Monitoreo avanzado con timeline y comparación de ejecuciones.",
    resourceUri: "ui://talend/run-monitor-pro.html",
    launcherToolName: "talend_app_run_monitor_pro",
    launchMessage: "Abriendo el monitor de ejecuciones profesional.",
    actions: [
      createNoInputAction("List runs", TOOL_NAMES.RUNS.LIST, "Lista ejecuciones recientes."),
      createTextAction("Read run", TOOL_NAMES.RUNS.READ, "Lee detalles de ejecución.", "runId"),
      createJsonAction("Start run", TOOL_NAMES.RUNS.START, "Inicia ejecución.", { jobName: "myJob" }, { requiresConfirmation: true }),
      createJsonAction("Explain error", TOOL_NAMES.ERRORS.EXPLAIN, "Explica error de ejecución.", { runId: "run_001" }),
    ],
  },
  {
    id: "launch-history",
    title: "Talend Launch History",
    description: "Historial de lanzamientos y configuraciones.",
    resourceUri: "ui://talend/launch-history.html",
    launcherToolName: "talend_app_launch_history",
    launchMessage: "Abriendo el historial de lanzamientos.",
    actions: [
      createNoInputAction("Launch configs", TOOL_NAMES.BRIDGE.LAUNCH_CONFIGS, "Lista configuraciones de lanzamiento."),
      createNoInputAction("List runs", TOOL_NAMES.RUNS.LIST, "Lista ejecuciones."),
    ],
  },
  {
    id: "runtime-comparison",
    title: "Talend Runtime Comparison",
    description: "Compara métricas de ejecución entre diferentes runs.",
    resourceUri: "ui://talend/runtime-comparison.html",
    launcherToolName: "talend_app_runtime_comparison",
    launchMessage: "Abriendo la comparación de runtime.",
    actions: [
      createNoInputAction("List runs", TOOL_NAMES.RUNS.LIST, "Lista ejecuciones para comparar."),
    ],
  },
];
