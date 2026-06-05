import * as z from "zod/v4";
import { bridgeOk, bridgeFail, loadBridge } from "./tools-base";
import type { TalendStudioBridgeClient } from "./bridge-client";
import { executionTracker } from "./execution-tracker.service";

async function resolveLaunchConfigName(bridge: TalendStudioBridgeClient, jobName: string): Promise<{ resolved: string; exact: boolean } | { resolved: null; error: string }> {
  const configsResult = await bridge.launchConfigs();
  if (!configsResult.ok || !configsResult.data?.configs) {
    return { resolved: jobName, exact: false };
  }

  const configs = configsResult.data.configs;
  const exactMatch = configs.find((c) => c.name === jobName);
  if (exactMatch) return { resolved: jobName, exact: true };

  const prefixMatches = configs.filter((c) => c.name && (c.name === jobName + " " || c.name.startsWith(jobName + " ")));
  if (prefixMatches.length === 1) {
    return { resolved: prefixMatches[0]!.name!, exact: false };
  }

  if (prefixMatches.length > 1) {
    return { resolved: null, error: `Launch config ambiguo: ${prefixMatches.map((c) => c.name).join(", ")}` };
  }

  return { resolved: jobName, exact: false };
}

export const executionTools = [
  {
    name: "talend_job_run_by_name",
    description: "Ejecuta un job por nombre de launch config.",
    inputSchema: z.object({
      jobName: z.string().describe("Nombre del job o launch config"),
      dryRun: z.boolean().optional().default(false).describe("Si es dry run"),
      saveBefore: z.boolean().optional().default(true).describe("Guardar antes de ejecutar"),
      waitForTermination: z.boolean().optional().default(true).describe("Esperar a que termine"),
      timeoutMs: z.number().optional().default(120000).describe("Timeout en ms"),
    }),
    handler: async (input: { jobName: string; dryRun?: boolean; saveBefore?: boolean; waitForTermination?: boolean; timeoutMs?: number }) => {
      try {
        const bridge = await loadBridge();

        const resolved = await resolveLaunchConfigName(bridge, input.jobName);
        if ("error" in resolved && resolved.resolved === null) {
          return bridgeFail({
            ok: false,
            source: "studio-bridge",
            confidence: "high",
            endpoint: "/job/run-by-name",
            error: { code: "AMBIGUOUS_LAUNCH_CONFIG", message: resolved.error },
          });
        }

        const launchResult = await bridge.runLaunchConfig(resolved.resolved, input.dryRun ?? false);

        if (!launchResult.ok) {
          return bridgeFail({
            ok: false,
            source: "studio-bridge",
            confidence: "high",
            endpoint: "/job/run-by-name",
            error: { code: "LAUNCH_FAILED", message: String(launchResult.error?.message ?? "Launch failed") },
          });
        }

        const launchId = launchResult.data?.launchId as string | undefined;
        let waitData: unknown = null;

        if (input.waitForTermination && launchId && !input.dryRun) {
          const waitResult = await bridge.launchWait(launchId, input.timeoutMs ?? 120000);
          waitData = waitResult.data;

          if (!waitResult.ok) {
            return bridgeFail({
              ok: false,
              source: "studio-bridge",
              confidence: "medium",
              endpoint: "/job/run-by-name",
              error: {
                code: "WAIT_FAILED",
                message: String(waitResult.error?.message ?? "No se pudo esperar el launch"),
              },
            });
          }
        }

        return bridgeOk({
          ok: true,
          source: "studio-bridge",
          confidence: "high",
          endpoint: "/job/run-by-name",
          data: {
            launched: true,
            launchId,
            launchResult: launchResult.data,
            waitResult: waitData,
            resolvedConfigName: resolved.resolved,
            exactMatch: resolved.exact,
          },
        });
      } catch (err) {
        return bridgeFail({
          ok: false,
          source: "execution",
          confidence: "low",
          endpoint: "/job/run-by-name",
          error: { code: "RUN_FAILED", message: String(err) },
        });
      }
    },
  },
  {
    name: "talend_job_wait_run",
    description: "Espera a que un launch existente termine.",
    inputSchema: z.object({
      launchId: z.string().describe("ID del launch a esperar"),
      timeoutMs: z.number().optional().default(120000).describe("Timeout en ms"),
    }),
    handler: async (input: { launchId: string; timeoutMs?: number }) => {
      try {
        const bridge = await loadBridge();
        const waitResult = await bridge.launchWait(input.launchId, input.timeoutMs ?? 120000);

        if (!waitResult.ok) {
          return bridgeFail({
            ok: false,
            source: "studio-bridge",
            confidence: "medium",
            endpoint: "/job/wait-run",
            error: {
              code: "WAIT_FAILED",
              message: String(waitResult.error?.message ?? "No se pudo esperar el launch"),
            },
          });
        }

        return bridgeOk({
          ok: true,
          source: "studio-bridge",
          confidence: "high",
          endpoint: "/job/wait-run",
          data: {
            launchId: input.launchId,
            terminated: true,
            status: waitResult.data?.status ?? "terminated",
            durationMs: waitResult.data?.durationMs,
            exitCode: waitResult.data?.exitCode,
            result: waitResult.data,
          },
        });
      } catch (err) {
        return bridgeFail({
          ok: false,
          source: "execution",
          confidence: "low",
          endpoint: "/job/wait-run",
          error: { code: "WAIT_FAILED", message: String(err) },
        });
      }
    },
  },
  {
    name: "talend_job_measure_runtime",
    description: "Mide el tiempo de ejecución de un job consultando runs anteriores.",
    inputSchema: z.object({
      jobName: z.string().describe("Nombre del job o launch config"),
      targetMs: z.number().optional().describe("Tiempo objetivo en ms para comparar"),
      latestOnly: z.boolean().optional().default(true).describe("Solo devolver el último run"),
    }),
    handler: async (input: { jobName: string; targetMs?: number; latestOnly?: boolean }) => {
      try {
        const bridge = await loadBridge();
        const runsResult = await bridge.launchRuns();

        if (!runsResult.ok) {
          return bridgeFail({
            ok: false,
            source: "studio-bridge",
            confidence: "low",
            endpoint: "/job/measure-runtime",
            error: { code: "RUNS_QUERY_FAILED", message: String(runsResult.error?.message ?? "No se pudieron obtener los runs") },
          });
        }

        const runs = (runsResult.data?.runs ?? []) as Array<{
          launchId?: string;
          launchConfigName?: string;
          configName?: string;
          name?: string;
          status?: string;
          startedAt?: number;
          startTime?: number;
          endTime?: number;
          durationMs?: number;
          exitCode?: number;
        }>;

        const filteredRuns = runs.filter((r) => {
          const launchName = r.launchConfigName ?? r.configName ?? r.name ?? "";
          return launchName === input.jobName ||
            launchName.startsWith(input.jobName + " ") ||
            launchName.includes(input.jobName);
        });

        if (filteredRuns.length === 0) {
          return bridgeOk({
            ok: true,
            source: "studio-bridge",
            confidence: "medium",
            endpoint: "/job/measure-runtime",
            data: {
              jobName: input.jobName,
              runsFound: 0,
              message: "No se encontraron runs para este job",
            },
          });
        }

        const sorted = [...filteredRuns].sort((a, b) => (b.startedAt ?? b.startTime ?? 0) - (a.startedAt ?? a.startTime ?? 0));
        const latest = sorted[0];
        const allDurations = sorted.map((r) => r.durationMs).filter((d): d is number => d !== undefined);

        const avgDuration = allDurations.length > 0
          ? Math.round(allDurations.reduce((a, b) => a + b, 0) / allDurations.length)
          : undefined;

        const result: Record<string, unknown> = {
          jobName: input.jobName,
          runsFound: filteredRuns.length,
          latestRun: latest ? {
            launchId: latest.launchId,
            launchConfigName: latest.launchConfigName ?? latest.configName ?? latest.name,
            status: latest.status,
            durationMs: latest.durationMs,
            startedAt: latest.startedAt ?? latest.startTime,
            endTime: latest.endTime,
            exitCode: latest.exitCode,
          } : null,
          averageDurationMs: avgDuration,
          allDurationsMs: input.latestOnly ? undefined : allDurations,
        };

        if (input.targetMs !== undefined && latest?.durationMs !== undefined) {
          result.passedTarget = latest.durationMs <= input.targetMs;
          result.targetMs = input.targetMs;
          result.diffMs = latest.durationMs - input.targetMs;
        }

        return bridgeOk({
          ok: true,
          source: "studio-bridge",
          confidence: "high",
          endpoint: "/job/measure-runtime",
          data: result,
        });
      } catch (err) {
        return bridgeFail({
          ok: false,
          source: "execution",
          confidence: "low",
          endpoint: "/job/measure-runtime",
          error: { code: "MEASURE_FAILED", message: String(err) },
        });
      }
    },
  },
  {
    name: "talend_bridge_launch_runs",
    description: "Obtiene el historial de ejecuciones de jobs desde el bridge.",
    inputSchema: z.object({
      jobName: z.string().optional().describe("Nombre opcional del job para filtrar"),
    }),
    handler: async (input: { jobName?: string }) => {
      try {
        const runs = await executionTracker.getLaunchRuns(input.jobName);
        return bridgeOk({
          ok: true,
          source: "studio-bridge",
          confidence: "high",
          endpoint: "/launch/runs",
          data: {
            runs: runs.map((r) => ({
              id: r.id,
              jobName: r.jobName,
              status: r.status,
              startTime: r.startTime,
              endTime: r.endTime,
              duration: r.duration,
              errorCount: r.errors?.length ?? 0,
            })),
          },
        });
      } catch (err) {
        return bridgeFail({
          ok: false,
          source: "execution",
          confidence: "low",
          endpoint: "/launch/runs",
          error: { code: "RUNS_FAILED", message: String(err) },
        });
      }
    },
  },
  {
    name: "talend_runs_collect_logs",
    description: "Recolecta los logs de una ejecucion especifica.",
    inputSchema: z.object({
      runId: z.string().describe("ID del run cuyos logs se recolectaran"),
    }),
    handler: async (input: { runId: string }) => {
      try {
        const logs = await executionTracker.getRunLogs(input.runId);
        const details = await executionTracker.getRunDetails(input.runId);

        return bridgeOk({
          ok: true,
          source: "studio-bridge",
          confidence: "high",
          endpoint: "/launch/run-logs",
          data: {
            runId: input.runId,
            jobName: details?.jobName,
            status: details?.status,
            logs,
            logCount: logs.length,
          },
        });
      } catch (err) {
        return bridgeFail({
          ok: false,
          source: "execution",
          confidence: "low",
          endpoint: "/launch/run-logs",
          error: { code: "LOGS_FAILED", message: String(err) },
        });
      }
    },
  },
  {
    name: "talend_runs_analyze_output",
    description: "Analiza los outputs generados por una ejecucion.",
    inputSchema: z.object({
      runId: z.string().describe("ID del run cuyos outputs se analizaran"),
    }),
    handler: async (input: { runId: string }) => {
      try {
        const outputs = await executionTracker.getGeneratedOutputs(input.runId);
        const details = await executionTracker.getRunDetails(input.runId);

        const analysis = {
          runId: input.runId,
          jobName: details?.jobName,
          status: details?.status,
          outputs,
          outputCount: outputs.length,
          hasErrors: (details?.errors?.length ?? 0) > 0,
          errorCount: details?.errors?.length ?? 0,
        };

        return bridgeOk({
          ok: true,
          source: "studio-bridge",
          confidence: "high",
          endpoint: "/launch/run-outputs",
          data: analysis,
        });
      } catch (err) {
        return bridgeFail({
          ok: false,
          source: "execution",
          confidence: "low",
          endpoint: "/launch/run-outputs",
          error: { code: "OUTPUT_FAILED", message: String(err) },
        });
      }
    },
  },
  {
    name: "talend_evidence_pack_generate",
    description: "Genera un paquete de evidencia para una ejecucion.",
    inputSchema: z.object({
      runId: z.string().describe("ID del run para generar evidencia"),
    }),
    handler: async (input: { runId: string }) => {
      try {
        const evidence = await executionTracker.createEvidencePackage(input.runId);

        if (!evidence) {
          return bridgeFail({
            ok: false,
            source: "studio-bridge",
            confidence: "medium",
            endpoint: "/evidence/pack",
            error: { code: "RUN_NOT_FOUND", message: `No se encontro el run ${input.runId}` },
          });
        }

        return bridgeOk({
          ok: true,
          source: "studio-bridge",
          confidence: "high",
          endpoint: "/evidence/pack",
          data: {
            runId: evidence.runId,
            summary: evidence.summary,
            logs: evidence.logs,
            outputs: evidence.outputs,
            artifacts: {
              generatedAt: evidence.generatedAt,
              duration: evidence.duration,
              status: evidence.status,
            },
          },
        });
      } catch (err) {
        return bridgeFail({
          ok: false,
          source: "execution",
          confidence: "low",
          endpoint: "/evidence/pack",
          error: { code: "EVIDENCE_FAILED", message: String(err) },
        });
      }
    },
  },
];
