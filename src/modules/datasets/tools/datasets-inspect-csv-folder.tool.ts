import type { InspectCsvFolderUseCase } from "../application/inspect-csv-folder.usecase";

export interface InspectCsvFolderTool {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: {
      folderPath: { type: "string"; description: string };
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
          files: { type: "array" };
          totalRows: { type: "number" };
          totalColumns: { type: "number" };
          schemaFingerprint: { type: "string" };
          csvFileCount: { type: "number" };
        };
      };
    };
  };
  safety: {
    classification: "public" | "restricted";
    permissions: "read" | "write" | "admin";
  };
}

export function createInspectCsvFolderTool(inspectCsvFolderUseCase: InspectCsvFolderUseCase) {
  return {
    name: "talend_datasets_inspect_csv_folder",
    description: "Inspecciona una carpeta con CSVs y devuelve schema, tipos inferidos y estadísticas.",
    inputSchema: {
      type: "object" as const,
      properties: {
        folderPath: { type: "string", description: "Ruta a la carpeta con CSVs" },
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
            files: { type: "array" },
            totalRows: { type: "number" },
            totalColumns: { type: "number" },
            schemaFingerprint: { type: "string" },
            csvFileCount: { type: "number" },
          },
        },
        durationMs: { type: "number" },
      },
    },
    safety: {
      classification: "public" as const,
      permissions: "read" as const,
    },
    handler: async (input: { folderPath: string }) => {
      const start = Date.now();
      try {
        const result = await inspectCsvFolderUseCase.execute(input.folderPath);
        return {
          ok: true,
          data: result,
          durationMs: Date.now() - start,
        };
      } catch (err) {
        return {
          ok: false,
          error: { code: "INSPECTION_FAILED", message: String(err) },
          durationMs: Date.now() - start,
        };
      }
    },
  };
}

export const ALIAS_INSPECT_CSV_FOLDER = "talend_dataset_inspect_csv_folder";
