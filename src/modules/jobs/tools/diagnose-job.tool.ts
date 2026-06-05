import * as z from "zod/v4";
import type { CallToolResult } from "@modelcontextprotocol/server";
import { diagnoseJob } from "../../../talend/diagnostics/job-diagnostics";
import { okResult, errorResult } from "../../../presentation/tools/common/result";

export const talendDiagnoseJobTool = {
  name: "talend_diagnose_job",
  description: "Diagnostica un job: componentes, conexiones, contextos, schemas y errores recientes.",
  inputSchema: z.object({
    jobName: z.string().optional(),
  }),
  handler: async (input: { jobName?: string }): Promise<CallToolResult> => {
    try {
      const data = await diagnoseJob(input?.jobName);
      const result = okResult(data, "talend_diagnose_job");
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        structuredContent: result,
      };
    } catch (e) {
      const result = errorResult("talend_diagnose_job", "DIAGNOSE_ERROR", `Error ejecutando diagnóstico de job: ${e}`);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        structuredContent: result,
        isError: true,
      };
    }
  },
};