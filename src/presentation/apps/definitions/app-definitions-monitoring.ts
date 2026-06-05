import type { PresentationAppDefinition } from "../app-types";
import { createJsonAction, createTextAction, createNoInputAction } from "./action-helpers";

export const MONITORING_APP_DEFINITIONS: PresentationAppDefinition[] = [
  {
    id: "run-monitor",
    title: "Talend Run Monitor",
    description: "Monitorea ejecuciones, logs y resultados recientes.",
    resourceUri: "ui://talend/run-monitor.html",
    launcherToolName: "talend_app_run_monitor",
    launchMessage: "Abriendo el monitor de ejecuciones.",
    uiMode: "react",
    actions: [
      createTextAction("Run job", "talend_job_run_by_name", "Ejecuta un job por launch config.", "jobName", { inputLabel: "Job name", inputPlaceholder: "myJob", requiresConfirmation: true }),
      createTextAction("Wait run", "talend_job_wait_run", "Espera a que termine una ejecución.", "launchId", { inputLabel: "Launch id", inputPlaceholder: "launch_123", requiresConfirmation: true }),
      createTextAction("Measure runtime", "talend_job_measure_runtime", "Mide el runtime de un job.", "jobName", { inputLabel: "Job name", inputPlaceholder: "myJob" }),
    ],
  },
  {
    id: "run-monitor-pro",
    title: "Talend Run Monitor Pro",
    description: "Monitor avanzado para ejecuciones, logs y comparaciones.",
    resourceUri: "ui://talend/run-monitor-pro.html",
    launcherToolName: "talend_app_run_monitor_pro",
    launchMessage: "Abriendo el monitor pro de ejecuciones.",
    uiMode: "react",
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
      createNoInputAction("List runs", "talend_runs_list", "Lista runs recientes."),
      createTextAction("Read run", "talend_runs_read", "Lee un run por id.", "runId", { inputLabel: "Run id", inputPlaceholder: "run_123" }),
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
      createNoInputAction("List runs", "talend_runs_list", "Lista runs recientes."),
      createTextAction("Read run", "talend_runs_read", "Lee un run por id.", "runId", { inputLabel: "Run id", inputPlaceholder: "run_123" }),
      createTextAction("Measure runtime", "talend_job_measure_runtime", "Mide runtime.", "jobName", { inputLabel: "Job name", inputPlaceholder: "myJob" }),
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
      createNoInputAction("List snapshots", "talend_snapshots_list", "Lista snapshots disponibles."),
      createTextAction("Read snapshot", "talend_snapshots_read", "Lee un snapshot.", "snapshotId", { inputLabel: "Snapshot id", inputPlaceholder: "snapshot_001" }),
      createTextAction("Diff snapshot", "talend_snapshots_diff", "Compara un snapshot con el estado actual.", "snapshotId", { inputLabel: "Snapshot id", inputPlaceholder: "snapshot_001" }),
    ],
  },
  {
    id: "snapshot-manager",
    title: "Talend Snapshot Manager",
    description: "Administrador de snapshots, cambios y actividad reciente.",
    resourceUri: "ui://talend/snapshot-manager.html",
    launcherToolName: "talend_app_snapshot_manager",
    launchMessage: "Abriendo el gestor de snapshots.",
    uiMode: "react",
    actions: [
      createNoInputAction("List snapshots", "talend_snapshots_list", "Lista snapshots disponibles."),
      createTextAction("Read snapshot", "talend_snapshots_read", "Lee un snapshot.", "snapshotId", { inputLabel: "Snapshot id", inputPlaceholder: "snapshot_001" }),
      createTextAction("Restore snapshot", "talend_snapshots_restore", "Restaura un snapshot.", "snapshotId", { inputLabel: "Snapshot id", inputPlaceholder: "snapshot_001", requiresConfirmation: true }),
    ],
  },
];
