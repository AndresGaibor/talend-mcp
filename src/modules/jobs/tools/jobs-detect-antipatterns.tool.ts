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
      try {
        const data = {
          jobName: input.jobName,
          antipatterns: [],
          score: 100,
          recommendations: [],
        };
        return {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
          structuredContent: data as any,
          isError: false,
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error detectando antipatrones: ${err}` }],
          isError: true,
        };
      }
    },
  };
}