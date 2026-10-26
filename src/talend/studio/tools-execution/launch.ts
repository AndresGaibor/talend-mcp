/** Tools de executionTools: launch. */
import * as z from "zod/v4";

import { bridgeOk, bridgeFail, loadBridge } from "../tools-base";
import { interpretLaunchWait, type LaunchWaitOutcome } from "../launch-wait-outcome";

import type { TalendStudioBridgeClient } from "../bridge-client";

import { executionTracker } from "../execution-tracker.service";
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
export const launch = [
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
        let outcome: LaunchWaitOutcome | null = null;

        if (input.waitForTermination && launchId && !input.dryRun) {
          const waitResult = await bridge.launchWait(launchId, input.timeoutMs ?? 120000);
          waitData = waitResult.data;
          outcome = interpretLaunchWait(launchId, waitResult.data);

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
          warning: outcome?.timedOut
            ? `El job sigue en ejecucion tras ${input.timeoutMs ?? 120000} ms: usa talend_job_wait_run con launchId para seguir esperando.`
            : undefined,
          data: {
            launched: true,
            launchId,
            launchResult: launchResult.data,
            waitResult: waitData,
            terminated: outcome?.terminated ?? null,
            timedOut: outcome?.timedOut ?? null,
            status: outcome?.status ?? null,
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
    description: "Espera a que un launch termine. `terminated: true` solo si Studio lo confirma; `WAIT_TIMEOUT` si sigue en marcha y `WAIT_UNOBSERVED` si el bridge no lo vigila (no se puede confirmar el fin).",
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

        const outcome = interpretLaunchWait(input.launchId, waitResult.data);
        if (outcome.timedOut) {
          const unobserved = outcome.status === "unobserved";
          return bridgeFail({
            ok: false,
            source: "studio-bridge",
            confidence: "high",
            endpoint: "/job/wait-run",
            data: { ...outcome, result: waitResult.data },
            error: unobserved
              ? {
                  code: "WAIT_UNOBSERVED",
                  message: `El launch ${input.launchId} no tiene vigilancia activa en el bridge: no se puede confirmar si termino.`,
                }
              : {
                  code: "WAIT_TIMEOUT",
                  message: `El launch ${input.launchId} no termino en ${input.timeoutMs ?? 120000} ms (estado: ${outcome.status}).`,
                },
          });
        }

        return bridgeOk({
          ok: true,
          source: "studio-bridge",
          confidence: "high",
          endpoint: "/job/wait-run",
          data: { ...outcome, result: waitResult.data },
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
  }
];
