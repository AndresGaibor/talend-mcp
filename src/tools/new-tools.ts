import * as z from "zod/v4";
import type { CallToolResult } from "@modelcontextprotocol/server";
import { getProbableActiveJob } from "../talend/studio/workbench-xmi";
import { tailRunOutput } from "../talend/runner/run-history";
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
  // ── Tools no cubiertas por presentationTools ──
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