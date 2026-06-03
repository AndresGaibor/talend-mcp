import * as z from "zod/v4";
import type { CallToolResult } from "@modelcontextprotocol/server";
import { diagnoseTalendEnvironment } from "../talend/diagnostics/workspace-diagnostics";
import { detectTalendStudioProcess } from "../talend/studio/process";
import { parseWorkbenchState, getProbableActiveJob } from "../talend/studio/workbench-xmi";
import { listLaunchConfigs } from "../talend/studio/launch-configs";
import { findExportedJobScripts } from "../talend/runner/exported-job-finder";
import { runExportedJob } from "../talend/runner/exported-job-runner";
import { listRuns, readRun, tailRunOutput } from "../talend/runner/run-history";
import { startTalendWatcher, stopTalendWatcher, getLiveWatcherStatus } from "../talend/live/watcher";
import { getLiveTalendState } from "../talend/live/state";
import { diagnoseJob } from "../talend/diagnostics/job-diagnostics";

type ToolDef = {
  name: string;
  description: string;
  inputSchema: z.ZodObject<any>;
  handler: (input: any) => Promise<CallToolResult>;
};

function ok(text: string, data?: unknown): CallToolResult {
  return {
    content: [{ type: "text", text }],
    ...(data ? { structuredContent: data as Record<string, unknown> } : {}),
  };
}

function err(text: string): CallToolResult {
  return { content: [{ type: "text", text }], isError: true };
}

function jsonOk(data: unknown): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    structuredContent: data as Record<string, unknown>,
  };
}

export const studioToolDefs: ToolDef[] = [
  // ── FASE 1: Diagnóstico del entorno ──
  {
    name: "talend_diagnose_environment",
    description: "Diagnostica el entorno de Talend: workspace, proyecto, metadata y proceso del Studio.",
    inputSchema: z.object({}),
    handler: async () => {
      try {
        const report = await diagnoseTalendEnvironment();
        return jsonOk(report);
      } catch (e) {
        return err(`Error ejecutando diagnóstico: ${e}`);
      }
    },
  },

  // ── FASE 2: Detección de proceso ──
  {
    name: "talend_studio_process",
    description: "Detecta si Talend Studio está corriendo como proceso en el sistema.",
    inputSchema: z.object({}),
    handler: async () => {
      try {
        const result = await detectTalendStudioProcess();
        return jsonOk(result);
      } catch (e) {
        return err(`Error detectando proceso: ${e}`);
      }
    },
  },

  // ── FASE 3: Workbench XMI ──
  {
    name: "talend_list_open_editors",
    description: "Lista los editores abiertos desde los archivos workbench XMI del workspace.",
    inputSchema: z.object({}),
    handler: async () => {
      try {
        const result = await parseWorkbenchState();
        return jsonOk(result);
      } catch (e) {
        return err(`Error leyendo editores abiertos: ${e}`);
      }
    },
  },
  {
    name: "talend_get_probable_active_job",
    description: "Detecta el job que probablemente está abierto en Talend Studio.",
    inputSchema: z.object({}),
    handler: async () => {
      try {
        const result = await getProbableActiveJob();
        return jsonOk(result);
      } catch (e) {
        return err(`Error detectando job activo: ${e}`);
      }
    },
  },

  // ── FASE 4: Launch configs ──
  {
    name: "talend_list_launch_configs",
    description: "Lista las launch configurations desde .metadata del workspace.",
    inputSchema: z.object({}),
    handler: async () => {
      try {
        const result = await listLaunchConfigs();
        return jsonOk(result);
      } catch (e) {
        return err(`Error listando launch configs: ${e}`);
      }
    },
  },

  // ── FASE 5: Runner de jobs exportados ──
  {
    name: "talend_find_exported_jobs",
    description: "Busca scripts exportados de jobs (*_run.sh o *_run.bat) en TALEND_BUILDS_DIR.",
    inputSchema: z.object({
      jobName: z.string().optional(),
      buildsDir: z.string().optional(),
    }),
    handler: async (input) => {
      try {
        const result = await findExportedJobScripts({ jobName: input?.jobName, buildsDir: input?.buildsDir });
        return jsonOk(result);
      } catch (e) {
        return err(`Error buscando jobs exportados: ${e}`);
      }
    },
  },
  {
    name: "talend_run_exported_job",
    description: "Ejecuta un job exportado desde TALEND_BUILDS_DIR.",
    inputSchema: z.object({
      jobName: z.string().describe("Nombre del job exportado"),
      scriptPath: z.string().optional().describe("Ruta directa al script (opcional)"),
      contextName: z.string().optional().describe("Nombre del contexto a usar"),
      timeoutMs: z.number().optional().describe("Timeout en milisegundos (default 300000)"),
      params: z.record(z.string(), z.string()).optional().describe("Parámetros adicionales como TALEND_PARAM_<key>"),
    }),
    handler: async (input) => {
      try {
        const result = await runExportedJob({
          jobName: input.jobName,
          scriptPath: input.scriptPath,
          contextName: input.contextName,
          timeoutMs: input.timeoutMs,
          params: input.params,
        });
        if (!result.ok) {
          return err(JSON.stringify(result, null, 2));
        }
        return jsonOk(result);
      } catch (e) {
        return err(`Error ejecutando job: ${e}`);
      }
    },
  },

  // ── FASE 6: Historial de ejecuciones ──
  {
    name: "talend_list_runs",
    description: "Lista las ejecuciones guardadas en .talend-mcp/runs/.",
    inputSchema: z.object({
      jobName: z.string().optional(),
      limit: z.number().optional(),
    }),
    handler: async (input) => {
      try {
        const runs = await listRuns({ jobName: input?.jobName, limit: input?.limit ?? 20 });
        return jsonOk({ runs, count: runs.length });
      } catch (e) {
        return err(`Error listando runs: ${e}`);
      }
    },
  },
  {
    name: "talend_read_run",
    description: "Lee el detalle de una ejecución guardada.",
    inputSchema: z.object({
      runId: z.string().describe("ID de la ejecución (ej: run_20260602_213012)"),
    }),
    handler: async (input) => {
      try {
        const run = await readRun(input.runId);
        if (!run) return err(`Run no encontrado: ${input.runId}`);
        return jsonOk(run);
      } catch (e) {
        return err(`Error leyendo run: ${e}`);
      }
    },
  },
  {
    name: "talend_tail_run_output",
    description: "Devuelve las últimas líneas del stdout o stderr de una ejecución.",
    inputSchema: z.object({
      runId: z.string().describe("ID de la ejecución"),
      stream: z.enum(["stdout", "stderr", "both"]).optional().default("both").describe("Stream a leer"),
      maxLines: z.number().optional().default(50).describe("Número máximo de líneas"),
    }),
    handler: async (input) => {
      try {
        const result = await tailRunOutput({
          runId: input.runId,
          stream: input.stream ?? "both",
          maxLines: input.maxLines ?? 50,
        });
        return jsonOk(result);
      } catch (e) {
        return err(`Error leyendo output: ${e}`);
      }
    },
  },

  // ── FASE 7: Live watcher ──
  {
    name: "talend_live_start",
    description: "Inicia el watcher reactivo para detectar cambios en el workspace.",
    inputSchema: z.object({
      projectPath: z.string().optional(),
    }),
    handler: async (input) => {
      try {
        const result = await startTalendWatcher({ projectPath: input?.projectPath });
        return jsonOk(result);
      } catch (e) {
        return err(`Error iniciando watcher: ${e}`);
      }
    },
  },
  {
    name: "talend_live_status",
    description: "Devuelve el estado actual del watcher reactivo.",
    inputSchema: z.object({}),
    handler: async () => {
      try {
        const status = getLiveWatcherStatus();
        if (!status.ok) {
          return jsonOk({ active: false, state: getLiveTalendState() });
        }
        return jsonOk({ active: true, ...status.data });
      } catch (e) {
        return err(`Error consultando estado: ${e}`);
      }
    },
  },
  {
    name: "talend_live_stop",
    description: "Detiene el watcher reactivo.",
    inputSchema: z.object({}),
    handler: async () => {
      try {
        const result = await stopTalendWatcher();
        return jsonOk(result);
      } catch (e) {
        return err(`Error deteniendo watcher: ${e}`);
      }
    },
  },
  {
    name: "talend_latest_changes",
    description: "Devuelve los últimos cambios detectados por el watcher.",
    inputSchema: z.object({}),
    handler: async () => {
      try {
        const state = getLiveTalendState();
        return jsonOk(state);
      } catch (e) {
        return err(`Error leyendo cambios: ${e}`);
      }
    },
  },

  // ── FASE 8: Diagnóstico de job ──
  {
    name: "talend_diagnose_job",
    description: "Diagnostica un job: componentes, conexiones, contextos, schemas y errores recientes.",
    inputSchema: z.object({
      jobName: z.string().optional(),
    }),
    handler: async (input) => {
      try {
        const result = await diagnoseJob(input?.jobName);
        return jsonOk(result);
      } catch (e) {
        return err(`Error ejecutando diagnóstico de job: ${e}`);
      }
    },
  },
];