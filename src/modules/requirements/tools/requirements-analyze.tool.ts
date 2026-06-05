import { z } from "zod/v4";
import type { McpToolDefinition, McpToolAnnotation } from "../../../server/adapt-tool";
import { adaptToolToMcp } from "../../../server/adapt-tool";
import { ok, fail } from "../../../presentation/tools/common/response";

export const AnalyzeRequirementsSchema = z.object({
  projectPath: z.string().describe("Ruta al proyecto Talend"),
});

export type AnalyzeRequirementsInput = z.infer<typeof AnalyzeRequirementsSchema>;

export function createRequirementsAnalyzeTool() {
  return {
    name: "talend_requirements_analyze",
    description: "Analiza los requisitos técnicos del proyecto y genera un reporte de cumplimiento.",
    inputSchema: AnalyzeRequirementsSchema,
    annotations: {
      readOnly: true,
    } as McpToolAnnotation,
    handler: async (input: AnalyzeRequirementsInput) => {
      const start = Date.now();
      try {
        return ok(
          {
            projectPath: input.projectPath,
            requirements: [],
            coverage: 0,
            gaps: [],
          },
          { startTime: start }
        );
      } catch (err) {
        return fail("REQUIREMENTS_ANALYSIS_ERROR", `Error analizando requisitos: ${err}`, { startTime: start });
      }
    },
  };
}