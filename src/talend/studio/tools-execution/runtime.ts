/** Tools de executionTools: runtime. */
import * as z from "zod/v4";

import { bridgeOk, bridgeFail, loadBridge } from "../tools-base";

import type { TalendStudioBridgeClient } from "../bridge-client";

import { executionTracker } from "../execution-tracker.service";
export const runtime = [
{
    name: "talend_job_measure_runtime",
    description: "Mide el tiempo de ejecuciÃ³n de un job consultando runs anteriores.",
    inputSchema: z.object({
      jobName: z.string().describe("Nombre del job o launch config"),
      targetMs: z.number().optional().describe("Tiempo objetivo en ms para comparar"),
      latestOnly: z.boolean().optional().default(true).describe("Solo devolver el Ãºltimo run"),
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
  }
];
