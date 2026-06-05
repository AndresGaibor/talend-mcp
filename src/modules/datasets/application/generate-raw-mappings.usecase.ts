import type { CsvFolderInspection, SchemaInference, CsvFileInfo } from "../domain/dataset.types";
import type { RawMappingOptions, RawMappingResult, BatchRawMappingsResult } from "../domain/csv-schema.types";

interface InspectionInput {
  files: CsvFileInfo[];
  totalRows: number;
  path?: string;
  folderPath?: string;
}

export class GenerateRawMappingsUseCase {
  execute(inspection: CsvFolderInspection | InspectionInput, options?: RawMappingOptions): BatchRawMappingsResult {
    const folderPath: string = ("folderPath" in inspection ? inspection.folderPath : (inspection as CsvFolderInspection).path) ?? "";
    const mappings: RawMappingResult[] = [];

    for (const file of inspection.files) {
      const baseName = file.relativePath.replace(/\\/g, "/").replace(/\.csv$/i, "").split("/").pop() ?? file.relativePath;

      let tableName: string;
      switch (options?.namingStrategy ?? "file_name") {
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

      const fullTableName = `${options?.targetSchema ?? "raw"}.${tableName}`;

      const columns: RawMappingResult["columns"] = file.columns.map((col) => {
        let talendType = "id_String";
        if (!options?.forceStringTypes) {
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

      const technicalColumns =
        options?.addTechnicalColumns !== false
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

    return {
      folderPath,
      mappings,
      csvFileCount: inspection.files.length,
      totalRows: inspection.totalRows,
    };
  }

  inferSchema(inspection: CsvFolderInspection | InspectionInput, tableName: string): SchemaInference {
    const technicalColumns = [
      { name: "_load_ts", value: "TalendDate.getCurrentDate()", description: "Timestamp de carga" },
      { name: "_load_run", value: "context.run_id", description: "ID de ejecución del job" },
    ];

    const firstFile = inspection.files[0];
    const schemaColumns = (firstFile?.columns ?? []).map((col) => {
      let dbType = "VARCHAR(255)";
      if (col.inferredType === "number") dbType = "BIGDECIMAL";
      else if (col.inferredType === "date") dbType = "TIMESTAMP";

      return {
        csvColumn: col.name,
        dbColumn: col.name.replace(/[^a-zA-Z0-9_]/g, "_"),
        dbType,
        nullable: col.nullable,
        isTechnical: false,
      };
    });

    return {
      tableName,
      columns: schemaColumns,
      technicalColumns,
    };
  }
}
