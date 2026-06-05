import { z } from "zod/v4";
import type { CallToolResult } from "@modelcontextprotocol/server";
import { ExportJobUseCase } from "../application/export-job.usecase";
import { okResult, errorResult } from "../../../presentation/tools/common/result";

const ExportJobSchema = z.object({
  jobId: z.string().describe("ID del job a exportar"),
  packageId: z.string().describe("ID del paquete a exportar"),
  destination: z.string().describe("Ruta destino de la exportación"),
  format: z.enum(["zip", "tar.gz", "directory"]).optional().default("zip").describe("Formato de exportación"),
});

const exportJobUseCase = new ExportJobUseCase();

export function createDeliverablesExportJobTool() {
  return {
    name: "talend_deliverables_export_job",
    description: "Exporta un paquete de deliverable al destino especificado",
    inputSchema: ExportJobSchema,
    annotations: {
      readOnly: false,
      destructive: false,
    },
    handler: async (input: z.infer<typeof ExportJobSchema>): Promise<CallToolResult> => {
      try {
        const job = await exportJobUseCase.execute({
          jobId: input.jobId,
          packageId: input.packageId,
          destination: input.destination,
          format: input.format,
        });
        return {
          content: [{ type: "text", text: JSON.stringify(job, null, 2) }],
          isError: false,
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error exportando job: ${err}` }],
          isError: true,
        };
      }
    },
  };
}