import * as z from "zod/v4";
import { bridgeOk, bridgeFail, loadBridge } from "./tools-base";
import type { TalendStudioBridgeClient } from "./bridge-client";

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
];
