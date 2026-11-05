import { createBridgeClient } from "../../../modules/studio-bridge/adapters/http-studio-bridge.client";
import { errorResult, okResult } from "../common/result";

interface RepositoryColumn {
  name: string | null;
  type?: unknown;
  sourceType?: unknown;
  length?: unknown;
  precision?: unknown;
  nullable?: unknown;
  key?: unknown;
}

interface RepositorySchema {
  connectionName: string | null;
  connectionType: string | null;
  name: string | null;
  columns: RepositoryColumn[];
}

/** Lista los schemas compartidos del repositorio (tablas y columnas) sin valores de configuracion. */
export function createListRepositorySchemasTool() {
  return {
    name: "talend_list_repository_schemas",
    description:
      "Lista los schemas compartidos del proyecto abierto en Talend Studio: nombre de la conexion, tipo, nombre del schema y sus columnas (nombre, tipo, longitud, nullable, key). No devuelve rutas, parametros ni credenciales.",
    annotations: { readOnly: true },
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
    handler: async () => {
      try {
        const bridge = await createBridgeClient();
        const result = await bridge.repositorySchemas();
        if (!result.ok) {
          return errorResult(
            "list-repository-schemas",
            "LIST_REPO_SCHEMAS_ERROR",
            `Error listando schemas: ${result.error?.message ?? "error desconocido"}`,
          );
        }

        const payload = (result.data?.result ?? result.data) as {
          schemas?: RepositorySchema[];
          count?: number;
        };
        return okResult(
          { schemas: payload?.schemas ?? [], count: payload?.count ?? 0 },
          "list-repository-schemas",
        );
      } catch (error) {
        return errorResult(
          "list-repository-schemas",
          "LIST_REPO_SCHEMAS_ERROR",
          `Error listando schemas: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    },
  };
}
