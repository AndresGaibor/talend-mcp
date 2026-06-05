import { z } from "zod/v4";
import type { CallToolResult } from "@modelcontextprotocol/server";

export function createErrorsExplainTool() {
  return {
    name: "talend_errors_explain",
    description: "Explica un error de Talend. Se puede proveer el mensaje directo o el ID de la ejecución (runId).",
    inputSchema: z.object({
      errorMessage: z.string().optional().describe("Mensaje de error"),
      runId: z.string().optional().describe("ID de la ejecución (runId)"),
    }),
    annotations: {
      readOnly: true,
    },
    handler: async (input: { errorMessage?: string; runId?: string }): Promise<CallToolResult> => {
      try {
        let msg = input.errorMessage || "";
        if (!msg && input.runId) {
          const { tailRunOutput } = await import("../../../talend/runner/run-history");
          const out = await tailRunOutput({ runId: input.runId, stream: "both", maxLines: 50 });
          msg = (out.stderr && out.stderr.trim().length > 0) ? out.stderr : (out.stdout || "");
        }

        if (!msg) {
          return {
            content: [{ type: "text", text: "No se pudo obtener el mensaje de error ni leer los logs de ejecución." }],
            isError: true,
          };
        }

        const { analyzeError } = await import("../../../talend/diagnostics/error-knowledge-base");
        const explanation = analyzeError(msg);
        const text = explanation
          ? `Error detectado: ${explanation.id}\nCategoría: ${explanation.category}\nCausa: ${explanation.cause}\nSolución sugerida: ${explanation.suggestedFix}`
          : "No se encontró explicación para el error.";
        return {
          content: [{ type: "text", text }],
          structuredContent: { explanation } as any,
          isError: false,
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error explicando error: ${err}` }],
          isError: true,
        };
      }
    },
  };
}
