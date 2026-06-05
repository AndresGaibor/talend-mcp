import { z } from "zod/v4";
import type { CallToolResult } from "@modelcontextprotocol/server";
import { RestoreSnapshotUseCase } from "../application/restore-snapshot.usecase";
import { FileSnapshotRepository } from "../adapters/file-snapshot.repository";

const RestoreSnapshotSchema = z.object({
  snapshotId: z.string().describe("ID del snapshot a restaurar"),
  targetPath: z.string().optional().describe("Ruta destino (por defecto sobreescribe origen)"),
  overwrite: z.boolean().optional().default(false).describe("Permitir sobreescribir archivos existentes"),
  confirmationToken: z.string().optional().describe("Token de confirmación del usuario"),
});

const repository = new FileSnapshotRepository();
const restoreSnapshotUseCase = new RestoreSnapshotUseCase(repository);

const PENDING_RESTORES = new Map<string, { snapshotId: string; targetPath?: string; overwrite?: boolean }>();

export function createSnapshotsRestoreTool() {
  return {
    name: "talend_snapshots_restore",
    description: "Restaura un snapshot previo. OPERACIÓN DESTRUCTIVA - requiere confirmación explícita del usuario.",
    inputSchema: RestoreSnapshotSchema,
    annotations: {
      readOnly: false,
      destructive: true,
      requiresConfirmation: true,
    },
    handler: async (input: z.infer<typeof RestoreSnapshotSchema>): Promise<CallToolResult> => {
      if (!input.confirmationToken) {
        const pendingId = `restore_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        PENDING_RESTORES.set(pendingId, {
          snapshotId: input.snapshotId,
          targetPath: input.targetPath,
          overwrite: input.overwrite,
        });

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              requiresConfirmation: true,
              message: `¿Estás seguro de que quieres restaurar el snapshot "${input.snapshotId}"? Esta operación sobreescribirá archivos existentes.`,
              confirmationToken: pendingId,
              warning: "OPERACIÓN DESTRUCTIVA",
            }, null, 2),
          }],
          isError: false,
        };
      }

      const pending = PENDING_RESTORES.get(input.confirmationToken);
      if (!pending) {
        return {
          content: [{ type: "text", text: "Token de confirmación inválido o expirado." }],
          isError: true,
        };
      }

      PENDING_RESTORES.delete(input.confirmationToken);

      try {
        await restoreSnapshotUseCase.execute({
          snapshotId: pending.snapshotId,
          targetPath: pending.targetPath,
          overwrite: pending.overwrite,
        });
        return {
          content: [{ type: "text", text: `Snapshot "${pending.snapshotId}" restaurado exitosamente.` }],
          isError: false,
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error restaurando snapshot: ${err}` }],
          isError: true,
        };
      }
    },
  };
}
