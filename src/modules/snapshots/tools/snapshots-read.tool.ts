import { z } from "zod/v4";
import type { CallToolResult } from "@modelcontextprotocol/server";
import { ReadSnapshotUseCase } from "../application/read-snapshot.usecase";
import { FileSnapshotRepository } from "../adapters/file-snapshot.repository";

const ReadSnapshotSchema = z.object({
  snapshotId: z.string().describe("ID del snapshot a leer"),
});

const repository = new FileSnapshotRepository();
const readSnapshotUseCase = new ReadSnapshotUseCase(repository);

export function createSnapshotsReadTool() {
  return {
    name: "talend_snapshots_read",
    description: "Lee un snapshot específico. Solo lectura.",
    inputSchema: ReadSnapshotSchema,
    annotations: {
      readOnly: true,
    },
    handler: async (input: z.infer<typeof ReadSnapshotSchema>): Promise<CallToolResult> => {
      try {
        const snapshot = await readSnapshotUseCase.execute(input.snapshotId);
        if (!snapshot) {
          return {
            content: [{ type: "text", text: `Snapshot no encontrado: ${input.snapshotId}` }],
            isError: true,
          };
        }
        return {
          content: [{ type: "text", text: JSON.stringify(snapshot, null, 2) }],
          isError: false,
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error leyendo snapshot: ${err}` }],
          isError: true,
        };
      }
    },
  };
}
