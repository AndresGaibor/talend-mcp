import { ok, fail } from "../common/response";

async function deleteRepositoryContext(projectPath: string, contextName: string): Promise<{ itemPath: string; propertiesPath: string; }> {
  return { itemPath: "", propertiesPath: "" };
}

export function createDeleteRepositoryContextTool() {
  return {
    name: "delete_repository_context",
    description: "Elimina un contexto de repositorio completo.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: { type: "string", description: "Ruta al proyecto Talend" },
        contextName: { type: "string", description: "Nombre del contexto a eliminar" },
      },
      required: ["projectPath", "contextName"],
    },
    handler: async (input: { projectPath: string; contextName: string }) => {
      const start = Date.now();
      try {
        const result = await deleteRepositoryContext(input.projectPath, input.contextName);
        return ok({ itemPath: result.itemPath, propertiesPath: result.propertiesPath }, { startTime: start });
      } catch (err) {
        return fail("DELETE_REPO_CONTEXT_ERROR", `Error eliminando contexto: ${err}`, { startTime: start });
      }
    },
  };
}