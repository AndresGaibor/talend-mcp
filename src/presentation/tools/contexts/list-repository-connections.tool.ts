import { createBridgeClient } from "../../../modules/studio-bridge/adapters/http-studio-bridge.client";
import { errorResult, okResult } from "../common/result";

interface RepositoryConnection {
  name: string | null;
  version: string | null;
  itemType: string;
  connectionType: string | null;
}

/** Lista las conexiones compartidas del repositorio sin exponer su configuracion. */
export function createListRepositoryConnectionsTool() {
  return {
    name: "talend_list_repository_connections",
    description:
      "Lista las conexiones compartidas del proyecto abierto en Talend Studio. Devuelve nombres y tipos, pero no rutas, parametros ni credenciales.",
    annotations: { readOnly: true },
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
    handler: async () => {
      try {
        const bridge = await createBridgeClient();
        const result = await bridge.repositoryConnections();
        if (!result.ok) {
          return errorResult(
            "list-repository-connections",
            "LIST_REPO_CONNECTIONS_ERROR",
            `Error listando conexiones: ${result.error?.message ?? "error desconocido"}`,
          );
        }

        const payload = (result.data?.result ?? result.data) as {
          connections?: RepositoryConnection[];
          count?: number;
        };
        return okResult(
          { connections: payload?.connections ?? [], count: payload?.count ?? 0 },
          "list-repository-connections",
        );
      } catch (error) {
        return errorResult(
          "list-repository-connections",
          "LIST_REPO_CONNECTIONS_ERROR",
          `Error listando conexiones: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    },
  };
}
