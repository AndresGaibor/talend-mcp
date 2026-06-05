import type { InferCsvSchemaUseCase } from "../application/infer-csv-schema.usecase";
import type { InspectCsvFolderUseCase } from "../application/inspect-csv-folder.usecase";

export interface InferCsvSchemaTool {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: {
      folderPath: { type: "string"; description: string };
      tableName: { type: "string"; description: string };
    };
    required: ["folderPath"];
  };
  outputSchema: {
    type: "object";
    properties: {
      ok: { type: "boolean" };
      data: {
        type: "object";
        properties: {
          tableName: { type: "string" };
          csvFileCount: { type: "number" };
          totalRows: { type: "number" };
          columns: { type: "array" };
        };
      };
    };
  };
  safety: {
    classification: "public" | "restricted";
    permissions: "read" | "write" | "admin";
  };
}

export function createInferCsvSchemaTool(
  inferCsvSchemaUseCase: InferCsvSchemaUseCase,
  inspectCsvFolderUseCase: InspectCsvFolderUseCase,
) {
  return {
    name: "talend_datasets_infer_csv_schema",
    description: "Infiere el schema de base de datos a partir de la inspección de un folder de CSVs.",
    inputSchema: {
      type: "object" as const,
      properties: {
        folderPath: { type: "string", description: "Ruta a la carpeta con CSVs" },
        tableName: { type: "string", description: "Nombre de la tabla destino (opcional)" },
      },
      required: ["folderPath"],
    },
    outputSchema: {
      type: "object" as const,
      properties: {
        ok: { type: "boolean" },
        data: {
          type: "object",
          properties: {
            tableName: { type: "string" },
            csvFileCount: { type: "number" },
            totalRows: { type: "number" },
            columns: { type: "array" },
          },
        },
        durationMs: { type: "number" },
      },
    },
    safety: {
      classification: "public" as const,
      permissions: "read" as const,
    },
    handler: async (input: { folderPath: string; tableName?: string }) => {
      const start = Date.now();
      try {
        const inspection = await inspectCsvFolderUseCase.execute(input.folderPath);
        const schema = inferCsvSchemaUseCase.execute(inspection, input.tableName);
        return {
          ok: true,
          data: schema,
          durationMs: Date.now() - start,
        };
      } catch (err) {
        return {
          ok: false,
          error: { code: "INFERENCE_FAILED", message: String(err) },
          durationMs: Date.now() - start,
        };
      }
    },
  };
}

export const ALIAS_INFER_CSV_SCHEMA = "talend_dataset_infer_csv_schema";
