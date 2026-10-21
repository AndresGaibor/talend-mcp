import { createBridgeClient } from "../../../modules/studio-bridge/adapters/http-studio-bridge.client";
import { okResult, errorResult } from "../common/result";

interface RepositoryContext {
  name: string;
  version?: string;
  defaultContext?: string;
  contexts: Array<{
    name: string;
    parameters: { name: string; type?: string; value?: string; prompt?: string }[];
  }>;
}

/**
 * Lee un contexto del proyecto (un item de tipo "Contexts") con sus entornos
 * y sus variables.
 */
export function createReadRepositoryContextTool() {
  return {
    name: "talend_read_repository_context",
    description:
      "Lee un contexto del proyecto de Talend: sus entornos y las variables de cada uno, con su valor.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: {
          type: "string",
          description: "Ruta al proyecto Talend (opcional: se usa el que este abierto)",
        },
        contextName: { type: "string", description: "Nombre (etiqueta) del contexto" },
      },
      required: ["contextName"],
    },
    handler: async (input: { projectPath?: string; contextName: string }) => {
      try {
        const bridge = await createBridgeClient();
        const result = await bridge.repositoryContexts({});
        if (!result.ok) {
          return errorResult(
            "read-repository-context",
            "READ_REPO_CONTEXT_ERROR",
            `Error leyendo el contexto: ${result.error?.message ?? "error desconocido"}`,
          );
        }
        const payload = (result.data?.result ?? result.data) as { contexts?: RepositoryContext[] };
        const context = (payload?.contexts ?? []).find(
          (item) => item.name === input.contextName,
        );
        if (!context) {
          return errorResult(
            "read-repository-context",
            "CONTEXT_NOT_FOUND",
            `Contexto no encontrado: ${input.contextName}`,
          );
        }
        return okResult({ context }, "read-repository-context");
      } catch (err) {
        return errorResult("read-repository-context", "READ_REPO_CONTEXT_ERROR", `Error leyendo el contexto: ${err}`);
      }
    },
  };
}
