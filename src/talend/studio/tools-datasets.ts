import * as z from "zod/v4";
import { bridgeOk, bridgeFail } from "./tools-base";
import { inspectCsvFolder, generateRawTableMapping } from "../datasets/csv-inspector";
import { getConfiguredProjectPath } from "../workspace";

export const datasetTools = [
  {
    name: "talend_dataset_inspect_csv_folder",
    description: "Inspecciona una carpeta con CSVs y devuelve schema, tipos inferidos y estatísticas.",
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
      tableName: z.string().describe("Nombre de la tabla destino"),
    }),
    handler: async ({ folderPath, tableName }: { folderPath: string; tableName: string }) => {
      try {
        const inspection = await inspectCsvFolder(folderPath);
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
            tableName,
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
        const result = generateRawTableMapping(inspection, tableName);

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
];
