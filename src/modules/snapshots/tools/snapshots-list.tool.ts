import { z } from "zod/v4";
import type { CallToolResult } from "@modelcontextprotocol/server";
import { ListSnapshotsUseCase } from "../application/list-snapshots.usecase";
import { FileSnapshotRepository } from "../adapters/file-snapshot.repository";
import { okResult, errorResult, type Confidence } from "../../../presentation/tools/common/result";

const ListSnapshotsSchema = z.object({
  sourcePath: z.string().optional().describe("Ruta source para filtrar snapshots"),
  limit: z.number().optional().default(50).describe("Límite de resultados"),
  offset: z.number().optional().default(0).describe("Offset para paginación"),
});

const repository = new FileSnapshotRepository();
const listSnapshotsUseCase = new ListSnapshotsUseCase(repository);

export function createSnapshotsListTool() {
  return {
    name: "talend_snapshots_list",
    description: "Lista todos los snapshots disponibles. Solo lectura.",
    inputSchema: ListSnapshotsSchema,
    annotations: {
      readOnly: true,
    },
    handler: async (input: z.infer<typeof ListSnapshotsSchema>): Promise<CallToolResult> => {
      try {
          const snapshots = await listSnapshotsUseCase.execute({
            sourcePath: input.sourcePath,
            limit: input.limit ?? 50,
            offset: input.offset ?? 0,
          });
          const result = okResult(snapshots, "talend_snapshots_list");
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
            structuredContent: result,
            isError: false,
          };
        } catch (err) {
          const result = errorResult("talend_snapshots_list", "LIST_ERROR", `Error listando snapshots: ${err}`);
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
            structuredContent: result,
            isError: true,
          };
        }
    },
  };
}
