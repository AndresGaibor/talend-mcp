import { createBridgeClient } from "../../../modules/studio-bridge/adapters/http-studio-bridge.client";
import { ok, fail } from "../common/response";

/** Elimina una variable de un entorno de un contexto del proyecto. */
export function createDeleteRepositoryContextParameterTool() {
  return {
    name: "talend_delete_repository_context_parameter",
    description: "Elimina una variable de un entorno de un contexto del proyecto de Talend.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: {
          type: "string",
          description: "Ruta al proyecto Talend (opcional: se usa el que este abierto)",
        },
        contextName: { type: "string", description: "Etiqueta del contexto" },
        parameterName: { type: "string", description: "Nombre de la variable a eliminar" },
        contextName_param: {
          type: "string",
          description: "Nombre del entorno (default: Default)",
        },
      },
      required: ["contextName", "parameterName"],
    },
    handler: async (input: {
      projectPath?: string;
      contextName: string;
      parameterName: string;
      contextName_param?: string;
    }) => {
      const start = Date.now();
      try {
        const bridge = await createBridgeClient();
        const result = await bridge.deleteRepositoryContextParameter({
          name: input.contextName,
          context: input.contextName_param ?? "Default",
          parameter: input.parameterName,
        });
        if (!result.ok) {
          return fail(
            "DELETE_PARAM_ERROR",
            `Error eliminando el parametro: ${result.error?.message ?? "error desconocido"}`,
            { startTime: start },
          );
        }
        return ok(result.data ?? { success: true }, { startTime: start });
      } catch (err) {
        return fail("DELETE_PARAM_ERROR", `Error eliminando el parametro: ${err}`, { startTime: start });
      }
    },
  };
}
