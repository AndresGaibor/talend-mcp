import { z } from "zod/v4";
import type { CallToolResult } from "@modelcontextprotocol/server";
import { CollectFilesUseCase } from "../application/collect-files.usecase";
import { TalendFileCollectorAdapter } from "../adapters/talend-file-collector.adapter";
import { okResult, errorResult } from "../../../presentation/tools/common/result";

const CollectFilesSchema = z.object({
  jobId: z.string().describe("ID del job cuyos archivos se recolectarán"),
  sourcePath: z.string().describe("Ruta origen para recolectar archivos"),
  patterns: z.array(z.string()).optional().describe("Patrones de archivos a incluir"),
  includeMetadata: z.boolean().optional().describe("Incluir metadatos de archivos"),
});

const fileCollector = new TalendFileCollectorAdapter();
const collectFilesUseCase = new CollectFilesUseCase(fileCollector);

export function createDeliverablesCollectTool() {
  return {
    name: "talend_deliverables_collect",
    description: "Recolecta archivos de un job para preparar un deliverable",
    inputSchema: CollectFilesSchema,
    annotations: {
      readOnly: true,
      destructive: false,
    },
    handler: async (input: z.infer<typeof CollectFilesSchema>): Promise<CallToolResult> => {
      try {
        const files = await collectFilesUseCase.execute({
          jobId: input.jobId,
          sourcePath: input.sourcePath,
          patterns: input.patterns,
          includeMetadata: input.includeMetadata,
        });
        return {
          content: [{ type: "text", text: JSON.stringify(files, null, 2) }],
          isError: false,
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error recolectando archivos: ${err}` }],
          isError: true,
        };
      }
    },
  };
}