import { z } from "zod/v4";
import type { CallToolResult } from "@modelcontextprotocol/server";
import { ClearSessionUseCase } from "../application/clear-session.usecase";
import { FileAppSessionRepository } from "../adapters/file-app-session.repository";

const ClearSessionSchema = z.object({
  sessionId: z.string().describe("ID de la sesión a eliminar"),
});

const repository = new FileAppSessionRepository();
const clearSessionUseCase = new ClearSessionUseCase(repository);

export function createAppSessionClearTool() {
  return {
    name: "talend_app_session_clear",
    description: "Elimina una sesión de app. Requiere confirmación.",
    inputSchema: ClearSessionSchema,
    annotations: {
      readOnly: false,
      requiresConfirmation: true,
    },
    handler: async (input: z.infer<typeof ClearSessionSchema>): Promise<CallToolResult> => {
      try {
        await clearSessionUseCase.execute(input.sessionId);
        return {
          content: [{ type: "text", text: `Sesión ${input.sessionId} eliminada` }],
          isError: false,
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error eliminando sesión: ${err}` }],
          isError: true,
        };
      }
    },
  };
}
