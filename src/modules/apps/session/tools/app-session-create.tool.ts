import { z } from "zod/v4";
import type { CallToolResult } from "@modelcontextprotocol/server";
import { CreateSessionUseCase } from "../application/create-session.usecase";
import { FileAppSessionRepository } from "../adapters/file-app-session.repository";

const CreateSessionSchema = z.object({
  id: z.string().optional().default("default").describe("ID de la sesión"),
  projectPath: z.string().optional().describe("Ruta del proyecto"),
});

const repository = new FileAppSessionRepository();
const createSessionUseCase = new CreateSessionUseCase(repository);

export function createAppSessionCreateTool() {
  return {
    name: "talend_app_session_create",
    description: "Crea una nueva sesión de app.",
    inputSchema: CreateSessionSchema,
    annotations: {
      readOnly: false,
    },
    handler: async (input: z.infer<typeof CreateSessionSchema>): Promise<CallToolResult> => {
      try {
        const session = await createSessionUseCase.execute({
          id: input.id,
          projectPath: input.projectPath,
        });
        return {
          content: [{ type: "text", text: `Sesión ${session.id} creada.` }],
          structuredContent: session as any,
          isError: false,
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error creando sesión: ${err}` }],
          isError: true,
        };
      }
    },
  };
}
