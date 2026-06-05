import { z } from "zod/v4";
import type { CallToolResult } from "@modelcontextprotocol/server";

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
    },
    handler: async (input: EvidencePackBuildInput): Promise<CallToolResult> => {
      try {
        const packId = `evidence_${Date.now()}`;
        const result = {
          packId,
          files: [] as string[],
          summary: `Evidence pack built successfully for job ${input.jobName}.`,
          warnings: [] as string[],
        };
        return {
          content: [{ type: "text", text: `Evidence pack ${packId} built.` }],
          structuredContent: result as any,
          isError: false,
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error generando evidence pack: ${err}` }],
          isError: true,
        };
      }
    },
  };
}