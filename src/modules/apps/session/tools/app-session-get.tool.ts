import { z } from "zod/v4";
import type { CallToolResult } from "@modelcontextprotocol/server";
import { GetSessionUseCase } from "../application/get-session.usecase";
import { FileAppSessionRepository } from "../adapters/file-app-session.repository";

const GetSessionSchema = z.object({
  sessionId: z.string().describe("ID de la sesión a obtener"),
  includeHistory: z.boolean().optional().default(false).describe("Incluir historial"),
});

const repository = new FileAppSessionRepository();
const getSessionUseCase = new GetSessionUseCase(repository);

export function createAppSessionGetTool() {
  return {
    name: "talend_app_session_get",
    description: "Obtiene una sesión de app por ID. Solo lectura.",
    inputSchema: GetSessionSchema,
    annotations: {
      readOnly: true,
    },
    handler: async (input: z.infer<typeof GetSessionSchema>): Promise<CallToolResult> => {
      try {
        const session = await getSessionUseCase.execute(input.sessionId, {
          includeHistory: input.includeHistory,
        });
        if (!session) {
          return {
            content: [{ type: "text", text: `Sesión ${input.sessionId} no encontrada` }],
            isError: true,
          };
        }
        return {
          content: [{ type: "text", text: JSON.stringify(session, null, 2) }],
          isError: false,
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error obteniendo sesión: ${err}` }],
          isError: true,
        };
      }
    },
  };
}
