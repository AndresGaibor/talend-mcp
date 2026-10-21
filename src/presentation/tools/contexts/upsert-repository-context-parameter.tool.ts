import { createBridgeClient } from "../../../modules/studio-bridge/adapters/http-studio-bridge.client";
import { ok, fail } from "../common/response";

/**
 * Crea o actualiza una variable de un contexto del proyecto.
 *
 * Cada entorno del contexto puede tener un valor distinto de la misma
 * variable: `contextName_param` dice en cual se cambia.
 */
export function createUpsertRepositoryContextParameterTool() {
  return {
    name: "talend_upsert_repository_context_parameter",
    description:
      "Crea o actualiza una variable de un contexto del proyecto de Talend, en el entorno indicado.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: {
          type: "string",
          description: "Ruta al proyecto Talend (opcional: se usa el que este abierto)",
        },
        contextName: { type: "string", description: "Etiqueta del contexto" },
        parameterName: { type: "string", description: "Nombre de la variable" },
        value: { type: "string", description: "Valor de la variable" },
        contextName_param: {
          type: "string",
          description: "Nombre del entorno (default: Default)",
        },
        type: { type: "string", description: "Tipo de la variable (id_String, id_Integer...)" },
        prompt: { type: "string", description: "Prompt para el parametro" },
      },
      required: ["contextName", "parameterName", "value"],
    },
    handler: async (input: {
      projectPath?: string;
      contextName: string;
      parameterName: string;
      value: string;
      contextName_param?: string;
      type?: string;
      prompt?: string;
    }) => {
      const start = Date.now();
      try {
        const bridge = await createBridgeClient();
        const result = await bridge.setRepositoryContextParameter({
          name: input.contextName,
          context: input.contextName_param ?? "Default",
          parameter: input.parameterName,
          value: input.value,
          type: input.type,
        });
        if (!result.ok) {
          return fail(
            "UPSERT_PARAM_ERROR",
            `Error upsertando el parametro: ${result.error?.message ?? "error desconocido"}`,
            { startTime: start },
          );
        }
        return ok(result.data ?? { success: true }, { startTime: start });
      } catch (err) {
        return fail("UPSERT_PARAM_ERROR", `Error upsertando el parametro: ${err}`, { startTime: start });
      }
    },
  };
}
