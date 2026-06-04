import * as z from "zod/v4";
import { bridgeOk, bridgeFail } from "./tools-base";
import { inspectCsvFolder, inferSchemaFromInspection } from "../datasets/csv-inspector";

export interface RawTableMapping {
  csvFile: string;
  targetTable: string;
  columns: Array<{ source: string; target: string; talendType: string; nullable: boolean }>;
  technicalColumns: Array<{ name: string; expression: string }>;
}

export const datasetTools = [
  {
    name: "talend_dataset_inspect_csv_folder",
    description: "Inspecciona una carpeta con CSVs y devuelve schema, tipos inferidos y estadísticas.",
    inputSchema: z.object({
      folderPath: z.string().describe("Ruta a la carpeta con CSVs"),
    }),
    handler: async ({ folderPath }: { folderPath: string }) => {
      try {
        const inspection = await inspectCsvFolder(folderPath);
        return bridgeOk({
          ok: true,
          source: "csv-inspector",
          confidence: "high",
          endpoint: "/dataset/inspect-csv-folder",
          data: inspection,
        });
      } catch (err) {
        return bridgeFail({
          ok: false,
          source: "csv-inspector",
          confidence: "low",
          endpoint: "/dataset/inspect-csv-folder",
          error: { code: "INSPECTION_FAILED", message: String(err) },
        });
      }
    },
  },
  {
    name: "talend_dataset_infer_csv_schema",
    description: "Infiere el schema de base de datos a partir de la inspección de un folder de CSVs.",
    inputSchema: z.object({
      folderPath: z.string().describe("Ruta a la carpeta con CSVs"),
      tableName: z.string().optional().describe("Nombre de la tabla destino (opcional, se infiere del nombre del archivo)"),
    }),
    handler: async ({ folderPath, tableName }: { folderPath: string; tableName?: string }) => {
      try {
        const inspection = await inspectCsvFolder(folderPath);
        const resolvedTableName = tableName ?? (inspection.files[0]?.relativePath.replace(/\\/g, "/").replace(/\.csv$/i, "").split("/").pop() ?? "raw_table");
        const schema = inspection.files[0]?.columns.map((col) => ({
          csvColumn: col.name,
          inferredType: col.inferredType,
          nullable: col.nullable,
          sampleValues: col.sampleValues,
        })) ?? [];

        return bridgeOk({
          ok: true,
          source: "csv-inspector",
          confidence: "high",
          endpoint: "/dataset/infer-csv-schema",
          data: {
            tableName: resolvedTableName,
            csvFileCount: inspection.files.length,
            totalRows: inspection.totalRows,
            columns: schema,
          },
        });
      } catch (err) {
        return bridgeFail({
          ok: false,
          source: "csv-inspector",
          confidence: "low",
          endpoint: "/dataset/infer-csv-schema",
          error: { code: "INFERENCE_FAILED", message: String(err) },
        });
      }
    },
  },
  {
    name: "talend_dataset_generate_raw_table_mapping",
    description: "Genera un mapping completo CSV → tabla raw con columnas técnicas (_load_ts, _load_run).",
    inputSchema: z.object({
      folderPath: z.string().describe("Ruta a la carpeta con CSVs"),
      tableName: z.string().describe("Nombre de la tabla raw destino"),
    }),
    handler: async ({ folderPath, tableName }: { folderPath: string; tableName: string }) => {
      try {
        const inspection = await inspectCsvFolder(folderPath);
        const result = inferSchemaFromInspection(inspection, tableName);

        return bridgeOk({
          ok: true,
          source: "csv-inspector",
          confidence: "high",
          endpoint: "/dataset/generate-raw-table-mapping",
          data: result,
        });
      } catch (err) {
        return bridgeFail({
          ok: false,
          source: "csv-inspector",
          confidence: "low",
          endpoint: "/dataset/generate-raw-table-mapping",
          error: { code: "MAPPING_FAILED", message: String(err) },
        });
      }
    },
  },
  {
    name: "talend_dataset_generate_raw_table_mappings",
    description: "Genera mappings para múltiples CSVs en una carpeta. Devuelve un mapping por archivo CSV.",
    inputSchema: z.object({
      folderPath: z.string().describe("Ruta a la carpeta con CSVs"),
      targetSchema: z.string().optional().default("raw").describe("Schema destino (ej: raw, stg)"),
      namingStrategy: z.enum(["file_name", "strip_dataset_suffix", "snake_case"]).optional().default("file_name").describe("Estrategia para nombrar tablas"),
      forceStringTypes: z.boolean().optional().default(true).describe("Forzar todos los tipos a string"),
      addTechnicalColumns: z.boolean().optional().default(true).describe("Agregar _load_ts y _load_run"),
    }),
    handler: async (input: { folderPath: string; targetSchema?: string; namingStrategy?: "file_name" | "strip_dataset_suffix" | "snake_case"; forceStringTypes?: boolean; addTechnicalColumns?: boolean }) => {
      try {
        const inspection = await inspectCsvFolder(input.folderPath);

        const mappings: RawTableMapping[] = [];

        for (const file of inspection.files) {
          const baseName = file.relativePath.replace(/\\/g, "/").replace(/\.csv$/i, "").split("/").pop() ?? file.relativePath;

          let tableName: string;
          switch (input.namingStrategy ?? "file_name") {
            case "strip_dataset_suffix":
              tableName = baseName.replace(/_dataset$/i, "").replace(/^olist_/i, "");
              break;
            case "snake_case":
              tableName = baseName.replace(/([A-Z])/g, "_$1").replace(/^_/, "").replace(/_+/g, "_").toLowerCase();
              break;
            case "file_name":
            default:
              tableName = baseName.replace(/^olist_/i, "");
          }

          const fullTableName = `${input.targetSchema ?? "raw"}.${tableName}`;

          const columns = file.columns.map((col) => {
            let talendType = "id_String";
            if (!input.forceStringTypes) {
              if (col.inferredType === "number") talendType = "id_Double";
              else if (col.inferredType === "date") talendType = "id_Date";
              else if (col.inferredType === "boolean") talendType = "id_Boolean";
            }

            return {
              source: col.name,
              target: col.name.replace(/[^a-zA-Z0-9_]/g, "_"),
              talendType,
              nullable: col.nullable,
            };
          });

          const technicalColumns = input.addTechnicalColumns
            ? [
                { name: "_load_ts", expression: "TalendDate.getCurrentDate()" },
                { name: "_load_run", expression: "context.run_id" },
              ]
            : [];

          mappings.push({
            csvFile: file.relativePath,
            targetTable: fullTableName,
            columns,
            technicalColumns,
          });
        }

        return bridgeOk({
          ok: true,
          source: "csv-inspector",
          confidence: "high",
          endpoint: "/dataset/generate-raw-table-mappings",
          data: {
            folderPath: input.folderPath,
            mappings,
            csvFileCount: inspection.files.length,
            totalRows: inspection.totalRows,
          },
        });
      } catch (err) {
        return bridgeFail({
          ok: false,
          source: "csv-inspector",
          confidence: "low",
          endpoint: "/dataset/generate-raw-table-mappings",
          error: { code: "MAPPINGS_FAILED", message: String(err) },
        });
      }
    },
  },
];
