import { z } from "zod/v4";
import type { CallToolResult } from "@modelcontextprotocol/server";

export function createErrorsSuggestFixTool() {
  return {
    name: "talend_errors_suggest_fix",
    description: "Sugiere un fix automático para un error.",
    inputSchema: z.object({
      errorMessage: z.string().optional().describe("Mensaje de error detectado"),
      error: z.string().optional().describe("Mensaje de error detectado (alternativo)"),
      jobId: z.string().optional().describe("ID del job (opcional)"),
      componentId: z.string().optional().describe("ID del componente (opcional)"),
    }),
    annotations: {
      readOnly: true,
    },
    handler: async (input: { errorMessage?: string; error?: string; jobId?: string; componentId?: string }): Promise<CallToolResult> => {
      try {
        const { suggestFix } = await import("../../../talend/diagnostics/error-knowledge-base");
        const msg = input.errorMessage || input.error || "";
        const result = suggestFix(msg);
        return {
          content: [{ type: "text", text: result.advice || "No se encontraron sugerencias." }],
          structuredContent: {
            error: result.error,
            advice: result.advice,
            changes: {},
          } as any,
          isError: false,
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error sugiriendo fix: ${err}` }],
          isError: true,
        };
      }
    },
  };
}
