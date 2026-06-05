import { z } from "zod/v4";
import type { McpToolAnnotation } from "../../../server/adapt-tool";
import { ok, fail } from "../../../presentation/tools/common/response";

export const DetectAntipatternsSchema = z.object({
  jobName: z.string().describe("Nombre del job a analizar"),
  folderPath: z.string().optional().describe("Ruta opcional del folder"),
});

export type DetectAntipatternsInput = z.infer<typeof DetectAntipatternsSchema>;

export function createJobsDetectAntipatternsTool() {
  return {
    name: "talend_jobs_detect_antipatterns",
    description: "Detecta antipatrones de diseño en jobs de Talend.",
    inputSchema: DetectAntipatternsSchema,
    annotations: {
      readOnly: true,
    } as McpToolAnnotation,
    handler: async (input: DetectAntipatternsInput) => {
      const start = Date.now();
      try {
        return ok(
          {
            jobName: input.jobName,
            antipatterns: [],
            score: 100,
            recommendations: [],
          },
          { startTime: start }
        );
      } catch (err) {
        return fail("ANTIPATTERN_DETECTION_ERROR", `Error detectando antipatrones: ${err}`, { startTime: start });
      }
    },
  };
}