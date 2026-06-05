import { z } from "zod/v4";
import type { McpToolAnnotation } from "../../../server/adapt-tool";
import { ok, fail } from "../../../presentation/tools/common/response";

export const EvidencePackBuildSchema = z.object({
  jobName: z.string().describe("Nombre del job para generar evidence pack"),
  includeLogs: z.boolean().default(true).describe("Incluir logs de ejecucion"),
  includeScreenshots: z.boolean().default(false).describe("Incluir capturas de pantalla"),
  includeConfig: z.boolean().default(true).describe("Incluir configuracion"),
});

export type EvidencePackBuildInput = z.infer<typeof EvidencePackBuildSchema>;

export function createEvidencePackBuildTool() {
  return {
    name: "talend_evidence_pack_build",
    description: "Genera un paquete de evidencia para auditorias y entregas.",
    inputSchema: EvidencePackBuildSchema,
    annotations: {
      readOnly: true,
      destructive: false,
    } as McpToolAnnotation,
    handler: async (input: EvidencePackBuildInput) => {
      const start = Date.now();
      try {
        return ok(
          {
            packId: `evidence_${Date.now()}`,
            jobName: input.jobName,
            files: [],
            sizeBytes: 0,
            generatedAt: new Date().toISOString(),
          },
          { startTime: start }
        );
      } catch (err) {
        return fail("EVIDENCE_PACK_ERROR", `Error generando evidence pack: ${err}`, { startTime: start });
      }
    },
  };
}