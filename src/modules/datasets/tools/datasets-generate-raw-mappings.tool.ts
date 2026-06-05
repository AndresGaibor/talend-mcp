import type { GenerateRawMappingsUseCase } from "../application/generate-raw-mappings.usecase";
import type { InspectCsvFolderUseCase } from "../application/inspect-csv-folder.usecase";
import type { RawMappingOptions } from "../domain/csv-schema.types";

export interface GenerateRawMappingsTool {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: {
      folderPath: { type: "string"; description: string };
      tableName: { type: "string"; description: string };
      targetSchema: { type: "string"; description: string };
      namingStrategy: { type: "string"; enum: ["file_name", "strip_dataset_suffix", "snake_case"] };
      forceStringTypes: { type: "boolean"; description: string };
      addTechnicalColumns: { type: "boolean"; description: string };
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
          folderPath: { type: "string" };
          mappings: { type: "array" };
          csvFileCount: { type: "number" };
          totalRows: { type: "number" };
        };
      };
    };
  };
  safety: {
    classification: "public" | "restricted";
    permissions: "read" | "write" | "admin";
  };
}

export function createGenerateRawMappingsTool(
  generateRawMappingsUseCase: GenerateRawMappingsUseCase,
  inspectCsvFolderUseCase: InspectCsvFolderUseCase,
) {
  return {
    name: "talend_datasets_generate_raw_mappings",
    description: "Genera mappings completos CSV → tabla raw con columnas técnicas (_load_ts, _load_run).",
    inputSchema: {
      type: "object" as const,
      properties: {
        folderPath: { type: "string", description: "Ruta a la carpeta con CSVs" },
        tableName: { type: "string", description: "Nombre de la tabla raw destino (para un solo CSV)" },
        targetSchema: { type: "string", description: "Schema destino (ej: raw, stg)", default: "raw" },
        namingStrategy: {
          type: "string",
          enum: ["file_name", "strip_dataset_suffix", "snake_case"],
          description: "Estrategia para nombrar tablas",
          default: "file_name",
        },
        forceStringTypes: { type: "boolean", description: "Forzar todos los tipos a string", default: true },
        addTechnicalColumns: { type: "boolean", description: "Agregar _load_ts y _load_run", default: true },
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
            folderPath: { type: "string" },
            mappings: { type: "array" },
            csvFileCount: { type: "number" },
            totalRows: { type: "number" },
          },
        },
        durationMs: { type: "number" },
      },
    },
    safety: {
      classification: "public" as const,
      permissions: "read" as const,
    },
    handler: async (
      input: {
        folderPath: string;
        tableName?: string;
        targetSchema?: string;
        namingStrategy?: "file_name" | "strip_dataset_suffix" | "snake_case";
        forceStringTypes?: boolean;
        addTechnicalColumns?: boolean;
      },
    ) => {
      const start = Date.now();
      try {
        const inspection = await inspectCsvFolderUseCase.execute(input.folderPath);

        if (input.tableName) {
          const singleMapping = generateRawMappingsUseCase.inferSchema(inspection, input.tableName);
          return {
            ok: true,
            data: {
              folderPath: input.folderPath,
              mappings: [
                {
                  csvFile: inspection.files[0]?.relativePath ?? "",
                  targetTable: `${input.targetSchema ?? "raw"}.${input.tableName}`,
                  columns: singleMapping.columns.map((col) => ({
                    source: col.csvColumn,
                    target: col.dbColumn,
                    talendType: col.dbType === "BIGDECIMAL" ? "id_Double" : col.dbType === "TIMESTAMP" ? "id_Date" : "id_String",
                    nullable: col.nullable,
                  })),
                  technicalColumns: singleMapping.technicalColumns.map((tc) => ({
                    name: tc.name,
                    expression: tc.value,
                  })),
                },
              ],
              csvFileCount: inspection.files.length,
              totalRows: inspection.totalRows,
            },
            durationMs: Date.now() - start,
          };
        }

        const options: RawMappingOptions = {
          targetSchema: input.targetSchema,
          namingStrategy: input.namingStrategy,
          forceStringTypes: input.forceStringTypes,
          addTechnicalColumns: input.addTechnicalColumns,
        };

        const result = generateRawMappingsUseCase.execute(inspection, options);
        return {
          ok: true,
          data: result,
          durationMs: Date.now() - start,
        };
      } catch (err) {
        return {
          ok: false,
          error: { code: "MAPPING_FAILED", message: String(err) },
          durationMs: Date.now() - start,
        };
      }
    },
  };
}

export const ALIAS_GENERATE_RAW_MAPPINGS = "talend_dataset_generate_raw_table_mappings";
