import { createBridgeClient } from "../../../modules/studio-bridge/adapters/http-studio-bridge.client";
import { listRepositoryContextItems } from "../../../infrastructure/repositories/context-xml.repository";
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
 * Lista los contextos del proyecto (los items de tipo "Contexts").
 *
 * Los items se leen del repositorio de Talend (con la API del IDE) y sus
 * entornos y variables del archivo `.item` de cada uno: la API del
 * repositorio no llega a ellos.
 */
export function createListRepositoryContextsTool() {
  return {
    name: "talend_list_repository_contexts",
    description:
      "Lista los contextos del proyecto de Talend (los items de tipo Contexts), con sus entornos y sus variables.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: {
          type: "string",
          description: "Ruta al proyecto Talend (opcional: se usa el que este abierto)",
        },
      },
      required: [],
    },
    handler: async (input: { projectPath?: string }) => {
      try {
        const bridge = await createBridgeClient();
        const result = await bridge.repositoryContexts({});
        if (!result.ok) {
          return errorResult(
            "list-repository-contexts",
            "LIST_REPO_CONTEXTS_ERROR",
            `Error listando contextos: ${result.error?.message ?? "error desconocido"}`,
          );
        }
        const payload = (result.data?.result ?? result.data) as {
          contexts?: RepositoryContext[];
          project?: string;
          path?: string;
        };
        const contexts = payload?.contexts ?? [];

        // Los entornos y sus variables estan en el `.item` de cada contexto.
        const projectPath = input.projectPath ?? payload?.path;
        if (projectPath) {
          try {
            const items = await listRepositoryContextItems(projectPath);
            for (const context of contexts) {
              const item = items.find(
                (candidate) => candidate.name === context.name && candidate.version === context.version,
              );
              if (item) {
                context.contexts = item.contexts.map((entorno) => ({
                  name: entorno.contextName,
                  parameters: entorno.parameters,
                }));
                context.defaultContext = item.contexts[0]?.contextName;
              }
            }
          } catch {
            // Sin los entornos: se devuelve lo que hay del repositorio.
          }
        }

        return okResult({ contexts, project: payload?.project, path: payload?.path }, "list-repository-contexts");
      } catch (err) {
        return errorResult("list-repository-contexts", "LIST_REPO_CONTEXTS_ERROR", `Error listando contextos: ${err}`);
      }
    },
  };
}
