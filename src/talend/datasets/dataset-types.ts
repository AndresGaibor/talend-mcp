export type CsvColumnType = "string" | "number" | "date" | "boolean" | "unknown";

export interface CsvColumn {
  name: string;
  inferredType: CsvColumnType;
  nullable: boolean;
  sampleValues: string[];
  distinctCount?: number;
}

export interface CsvFileInfo {
  path: string;
  relativePath: string;
  rowCount: number;
  columns: CsvColumn[];
  delimiter: string;
  quoteChar: string;
  lineEnding: string;
  encoding: string;
}

export interface CsvFolderInspection {
  path: string;
  files: CsvFileInfo[];
  totalRows: number;
  totalColumns: number;
  schemaFingerprint: string;
}

export interface SchemaInference {
  tableName: string;
  columns: Array<{
    csvColumn: string;
    dbColumn: string;
    dbType: string;
    nullable: boolean;
    isTechnical: boolean;
  }>;
  technicalColumns: Array<{
    name: string;
    value: string;
    description: string;
  }>;
}

export interface RawTableMapping {
  csvPath: string;
  tableName: string;
  mapping: SchemaInference;
}
