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
      "Lista los schemas compartidos del proyecto abierto en Talend Studio: nombre de la conexion, tipo, nombre del schema y sus columnas (nombre, tipo, longitud, nullable, key). No devuelve rutas, parametros ni credenciales. Acepta limit/offset.",
    annotations: { readOnly: true },
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Maximo a devolver (defecto 50)" },
        offset: { type: "number", description: "Cuantos omitir (defecto 0)" },
      },
      required: [],
    },
    handler: async (input: { limit?: number; offset?: number }) => {
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
        const limit = input.limit ?? 50;
        const offset = input.offset ?? 0;
        const all = payload?.schemas ?? [];
        return okResult(
          { schemas: all.slice(offset, offset + limit), count: all.length },
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
