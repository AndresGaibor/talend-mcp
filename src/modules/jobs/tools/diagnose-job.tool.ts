import * as z from "zod/v4";
import type { CallToolResult } from "@modelcontextprotocol/server";
import { diagnoseJob } from "../../../talend/diagnostics/job-diagnostics";

function jsonOk(data: unknown): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    structuredContent: data as Record<string, unknown>,
  };
}

function err(text: string): CallToolResult {
  return { content: [{ type: "text", text }], isError: true };
}

export const talendDiagnoseJobTool = {
  name: "talend_diagnose_job",
  description: "Diagnostica un job: componentes, conexiones, contextos, schemas y errores recientes.",
  inputSchema: z.object({
    jobName: z.string().optional(),
  }),
  handler: async (input: { jobName?: string }): Promise<CallToolResult> => {
    try {
      const result = await diagnoseJob(input?.jobName);
      return jsonOk(result);
    } catch (e) {
      return err(`Error ejecutando diagnóstico de job: ${e}`);
    }
  },
};