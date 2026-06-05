import type { CsvFolderInspection, CsvFileInfo } from "../domain/dataset.types";
import type { CsvSchemaDefinition, CsvSchemaColumn } from "../domain/csv-schema.types";

interface InspectionResult {
  files: CsvFileInfo[];
  totalRows: number;
}

export class InferCsvSchemaUseCase {
  execute(inspection: CsvFolderInspection | InspectionResult, tableName?: string): CsvSchemaDefinition {
    const resolvedTableName =
      tableName ??
      (inspection.files[0]?.relativePath.replace(/\\/g, "/").replace(/\.csv$/i, "").split("/").pop() ?? "raw_table");

    const columns: CsvSchemaColumn[] = inspection.files[0]?.columns.map((col) => ({
      csvColumn: col.name,
      inferredType: col.inferredType,
      nullable: col.nullable,
      sampleValues: col.sampleValues,
    })) ?? [];

    return {
      tableName: resolvedTableName,
      csvFileCount: inspection.files.length,
      totalRows: inspection.totalRows,
      columns,
    };
  }
}
