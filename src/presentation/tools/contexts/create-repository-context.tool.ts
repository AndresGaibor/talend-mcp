import { createBridgeClient } from "../../../modules/studio-bridge/adapters/http-studio-bridge.client";
import { ok, fail } from "../common/response";

/**
 * Crea un contexto del proyecto (un item de tipo "Contexts").
 *
 * Se crea con la API del repositorio de Talend, no escribiendo el XML a mano:
 * asi el IDE mantiene su modelo y el item guardado es el que espera.
 */
export function createRepositoryContextTool() {
  return {
    name: "talend_create_repository_context",
    description:
      "Crea un contexto del proyecto de Talend (un item de tipo Contexts) con su entorno y sus variables. Si ya existe uno con la misma etiqueta, lo reemplaza.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: {
          type: "string",
          description: "Ruta al proyecto Talend (opcional: se usa el que este abierto)",
        },
        name: { type: "string", description: "Etiqueta del contexto" },
        version: { type: "string", description: "Version del contexto (default: 0.1)" },
        context: {
          type: "string",
          description: "Nombre del entorno (default: Default)",
        },
        parameters: {
          type: "array",
          description: "Las variables del entorno",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              value: { type: "string" },
              type: { type: "string", description: "id_String (default), id_Integer, id_Double, id_Boolean, id_Date..." },
            },
            required: ["name", "value"],
          },
        },
        purpose: { type: "string", description: "Proposito del contexto" },
        description: { type: "string", description: "Descripcion del contexto" },
      },
      required: ["name"],
    },
    handler: async (input: {
      projectPath?: string;
      name: string;
      version?: string;
      context?: string;
      parameters?: Array<{ name: string; value: string; type?: string }>;
      purpose?: string;
      description?: string;
    }) => {
      const start = Date.now();
      try {
        const bridge = await createBridgeClient();
        const result = await bridge.createRepositoryContext({
          name: input.name,
          version: input.version,
          context: input.context,
          parameters: input.parameters,
        });
        if (!result.ok) {
          return fail(
            "CREATE_REPO_CONTEXT_ERROR",
            `Error creando el contexto: ${result.error?.message ?? "error desconocido"}`,
            { startTime: start },
          );
        }
        return ok(result.data ?? { name: input.name }, { startTime: start });
      } catch (err) {
        return fail("CREATE_REPO_CONTEXT_ERROR", `Error creando el contexto: ${err}`, { startTime: start });
      }
    },
  };
}
