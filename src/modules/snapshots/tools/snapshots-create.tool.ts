import { z } from "zod/v4";
import type { CallToolResult } from "@modelcontextprotocol/server";
import { CreateSnapshotUseCase } from "../application/create-snapshot.usecase";
import { FileSnapshotRepository } from "../adapters/file-snapshot.repository";
import { okResult, errorResult } from "../../../presentation/tools/common/result";

const CreateSnapshotSchema = z.object({
  name: z.string().describe("Nombre del snapshot"),
  sourcePath: z.string().describe("Ruta origen a snapshotear"),
  description: z.string().optional().describe("Descripción del snapshot"),
  tags: z.array(z.string()).optional().describe("Tags para categorizar"),
});

const repository = new FileSnapshotRepository();
const createSnapshotUseCase = new CreateSnapshotUseCase(repository);

export function createSnapshotsCreateTool() {
  return {
    name: "talend_snapshots_create",
    description: "Crea un nuevo snapshot del estado actual. No destructivo.",
    inputSchema: CreateSnapshotSchema,
    annotations: {
      readOnly: false,
      destructive: false,
    },
    handler: async (input: z.infer<typeof CreateSnapshotSchema>): Promise<CallToolResult> => {
      try {
        const snapshot = await createSnapshotUseCase.execute({
          name: input.name,
          sourcePath: input.sourcePath,
          description: input.description,
          tags: input.tags,
        });
        return {
          content: [{ type: "text", text: JSON.stringify(snapshot, null, 2) }],
          isError: false,
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error creando snapshot: ${err}` }],
          isError: true,
        };
      }
    },
  };
}
