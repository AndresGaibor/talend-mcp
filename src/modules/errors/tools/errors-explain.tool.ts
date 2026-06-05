import { z } from "zod/v4";
import type { CallToolResult } from "@modelcontextprotocol/server";
import { okResult, errorResult } from "../../../presentation/tools/common/result";

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
          const result = errorResult("talend_errors_explain", "NO_ERROR", "No se pudo obtener el mensaje de error ni leer los logs de ejecución.");
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
            structuredContent: result,
            isError: true,
          };
        }

        const { analyzeError } = await import("../../../talend/diagnostics/error-knowledge-base");
        const explanation = analyzeError(msg);
        const result = explanation
          ? okResult({ id: explanation.id, category: explanation.category, cause: explanation.cause, suggestedFix: explanation.suggestedFix }, "talend_errors_explain")
          : okResult({ message: "No se encontró explicación para el error." }, "talend_errors_explain", "low");
        const text = explanation
          ? `Error detectado: ${explanation.id}\nCategoría: ${explanation.category}\nCausa: ${explanation.cause}\nSolución sugerida: ${explanation.suggestedFix}`
          : "No se encontró explicación para el error.";
        return {
          content: [{ type: "text", text }],
          structuredContent: result,
          isError: false,
        };
      } catch (err) {
        const result = errorResult("talend_errors_explain", "EXPLAIN_ERROR", `Error explicando error: ${err}`);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          structuredContent: result,
          isError: true,
        };
      }
    },
  };
}
