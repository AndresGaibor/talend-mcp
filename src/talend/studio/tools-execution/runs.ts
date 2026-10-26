/** Tools de executionTools: runs. */
import * as z from "zod/v4";

import { bridgeOk, bridgeFail, loadBridge } from "../tools-base";

import type { TalendStudioBridgeClient } from "../bridge-client";

import { executionTracker } from "../execution-tracker.service";
export const runs = [
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
  }
];
