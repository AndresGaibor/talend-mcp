export interface CsvSchemaColumn {
  csvColumn: string;
  inferredType: "string" | "number" | "date" | "boolean" | "unknown";
  nullable: boolean;
  sampleValues: string[];
}

export interface CsvSchemaDefinition {
  tableName: string;
  csvFileCount: number;
  totalRows: number;
  columns: CsvSchemaColumn[];
}

export interface RawMappingOptions {
  targetSchema?: string;
  namingStrategy?: "file_name" | "strip_dataset_suffix" | "snake_case";
  forceStringTypes?: boolean;
  addTechnicalColumns?: boolean;
}

export interface RawMappingResult {
  csvFile: string;
  targetTable: string;
  columns: Array<{
    source: string;
    target: string;
    talendType: string;
    nullable: boolean;
  }>;
  technicalColumns: Array<{
    name: string;
    expression: string;
  }>;
}

export interface BatchRawMappingsResult {
  folderPath: string;
  mappings: RawMappingResult[];
  csvFileCount: number;
  totalRows: number;
}
