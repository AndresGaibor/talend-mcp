import { duplicateDqAnalysis } from "../../../infrastructure/repositories/dq-xml.repository";
import { ok, fail } from "../common/response";

export function createDuplicateAnalysisTool() {
  return {
    name: "duplicate_analysis",
    description: "Duplica un análisis DQ existente con un nuevo nombre.",
    inputSchema: {
      type: "object",
      properties: {
        analysisPath: { type: "string", description: "Ruta completa al archivo .ana del análisis a duplicar" },
        newName: { type: "string", description: "Nombre para el nuevo análisis duplicado" },
      },
      required: ["analysisPath", "newName"],
    },
    handler: async (input: { analysisPath: string; newName: string }) => {
      const start = Date.now();
      try {
        const result = await duplicateDqAnalysis(input.analysisPath, input.newName);
        return ok({ duplicated: true, ...result }, { startTime: start });
      } catch (err) {
        return fail("DUPLICATE_ANALYSIS_ERROR", `Error duplicando análisis DQ: ${err}`, { startTime: start });
      }
    },
  };
}