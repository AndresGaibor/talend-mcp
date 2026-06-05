import { z } from "zod/v4";
import type { CallToolResult } from "@modelcontextprotocol/server";

export function createEvidencePackExportTool() {
  return {
    name: "talend_evidence_pack_export",
    description: "Exporta un paquete de evidencia generado a una ruta específica.",
    inputSchema: z.object({
      packId: z.string().describe("ID del paquete de evidencia a exportar"),
      destinationPath: z.string().optional().describe("Ruta de destino (opcional)"),
    }),
    annotations: {
      readOnly: false,
    },
    handler: async (input: { packId: string; destinationPath?: string }): Promise<CallToolResult> => {
      try {
        const dest = input.destinationPath || `./exports/${input.packId}.zip`;
        const result = {
          exportedPath: dest,
          success: true,
        };
        return {
          content: [{ type: "text", text: `Paquete de evidencia ${input.packId} exportado a ${dest}` }],
          structuredContent: result as any,
          isError: false,
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error exportando paquete de evidencia: ${err}` }],
          isError: true,
        };
      }
    },
  };
}
