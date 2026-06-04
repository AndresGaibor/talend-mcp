import { ok, fail } from "../common/response";

async function deleteRepositoryContextParameter(
  projectPath: string,
  contextName: string,
  parameterName: string,
  contextName_param?: string
): Promise<void> {
}

export function createDeleteRepositoryContextParameterTool() {
  return {
    name: "delete_repository_context_parameter",
    description: "Elimina un parámetro específico de un contexto de repositorio.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: { type: "string", description: "Ruta al proyecto Talend" },
        contextName: { type: "string", description: "Nombre del contexto" },
        parameterName: { type: "string", description: "Nombre del parámetro a eliminar" },
        contextName_param: { type: "string", description: "Nombre del contexto interno (default: Default)" },
      },
      required: ["projectPath", "contextName", "parameterName"],
    },
    handler: async (input: { projectPath: string; contextName: string; parameterName: string; contextName_param?: string }) => {
      const start = Date.now();
      try {
        await deleteRepositoryContextParameter(
          input.projectPath,
          input.contextName,
          input.parameterName,
          input.contextName_param,
        );
        return ok({ success: true }, { startTime: start });
      } catch (err) {
        return fail("DELETE_PARAM_ERROR", `Error eliminando parámetro: ${err}`, { startTime: start });
      }
    },
  };
}