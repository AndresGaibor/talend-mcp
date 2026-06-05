import { z } from "zod/v4";
import type { CallToolResult } from "@modelcontextprotocol/server";
import { DiffSnapshotUseCase } from "../application/diff-snapshot.usecase";
import { FileSnapshotRepository } from "../adapters/file-snapshot.repository";

const DiffSnapshotSchema = z.object({
  snapshotIdA: z.string().describe("ID del primer snapshot"),
  snapshotIdB: z.string().describe("ID del segundo snapshot"),
});

const repository = new FileSnapshotRepository();
const diffSnapshotUseCase = new DiffSnapshotUseCase(repository);

export function createSnapshotsDiffTool() {
  return {
    name: "talend_snapshots_diff",
    description: "Compara dos snapshots y muestra las diferencias. Solo lectura.",
    inputSchema: DiffSnapshotSchema,
    annotations: {
      readOnly: true,
    },
    handler: async (input: z.infer<typeof DiffSnapshotSchema>): Promise<CallToolResult> => {
      try {
        const diff = await diffSnapshotUseCase.execute(input.snapshotIdA, input.snapshotIdB);
        return {
          content: [{ type: "text", text: JSON.stringify(diff, null, 2) }],
          isError: false,
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error comparando snapshots: ${err}` }],
          isError: true,
        };
      }
    },
  };
}
