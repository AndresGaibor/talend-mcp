import * as z from "zod/v4";
import { bridgeOk, bridgeFail, loadBridge } from "./tools-base";

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
        const launchResult = await bridge.runLaunchConfig(input.jobName, input.dryRun ?? false);

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

        if (input.waitForTermination && launchId && !input.dryRun) {
          const waitResult = await bridge.runLaunchConfig(input.jobName, false, "wait");
          void waitResult;
        }

        return bridgeOk({
          ok: launchResult.ok,
          source: "studio-bridge",
          confidence: "high",
          endpoint: "/job/run-by-name",
          data: {
            launched: true,
            launchId,
            launchResult: launchResult.data,
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
        return bridgeOk({
          ok: true,
          source: "execution",
          confidence: "high",
          endpoint: "/job/wait-run",
          data: {
            launchId: input.launchId,
            status: "waiting",
            timeoutMs: input.timeoutMs ?? 120000,
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
    description: "Mide el tiempo de ejecución de un job.",
    inputSchema: z.object({
      jobName: z.string().describe("Nombre del job"),
      targetMs: z.number().optional().describe("Tiempo objetivo en ms"),
    }),
    handler: async (input: { jobName: string; targetMs?: number }) => {
      try {
        return bridgeOk({
          ok: true,
          source: "execution",
          confidence: "low",
          endpoint: "/job/measure-runtime",
          data: {
            jobName: input.jobName,
            targetMs: input.targetMs,
            note: "Measurement requiere ejecutar el job primero y consultar launch-runs",
          },
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
