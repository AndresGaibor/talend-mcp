import { createBridgeClient } from "../../../modules/studio-bridge/adapters/http-studio-bridge.client";
import { ok, fail } from "../common/response";

/**
 * Elimina un contexto del proyecto (un item de tipo "Contexts").
 *
 * Se borra desde el repositorio de Talend, no del disco: si no, queda un item
 * fantasma y la proxima vez que se cree uno con la misma etiqueta salta el
 * modal "Jobname Error".
 */
export function createDeleteRepositoryContextTool() {
  return {
    name: "talend_delete_repository_context",
    description: "Elimina un contexto completo del proyecto de Talend.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: {
          type: "string",
          description: "Ruta al proyecto Talend (opcional: se usa el que este abierto)",
        },
        contextName: { type: "string", description: "Etiqueta del contexto a eliminar" },
      },
      required: ["contextName"],
    },
    handler: async (input: { projectPath?: string; contextName: string }) => {
      const start = Date.now();
      try {
        const bridge = await createBridgeClient();
        const result = await bridge.deleteRepositoryContext({ name: input.contextName });
        if (!result.ok) {
          return fail(
            "DELETE_REPO_CONTEXT_ERROR",
            `Error eliminando el contexto: ${result.error?.message ?? "error desconocido"}`,
            { startTime: start },
          );
        }
        return ok(result.data ?? { name: input.contextName }, { startTime: start });
      } catch (err) {
        return fail("DELETE_REPO_CONTEXT_ERROR", `Error eliminando el contexto: ${err}`, { startTime: start });
      }
    },
  };
}
