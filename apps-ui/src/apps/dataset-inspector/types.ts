export interface CsvColumn {
  name: string;
  inferredType: string;
  nullable: boolean;
  sampleValues: string[];
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

export interface DatasetInspectionResult {
  folderPath: string;
  files: CsvFileInfo[];
  totalRows: number;
  totalColumns: number;
  schemaFingerprint: string;
  csvFileCount: number;
}

export interface RawMappingColumn {
  source: string;
  target: string;
  talendType: string;
  nullable: boolean;
}

export interface TechnicalColumn {
  name: string;
  expression: string;
}

export interface RawMappingResult {
  csvFile: string;
  targetTable: string;
  columns: RawMappingColumn[];
  technicalColumns: TechnicalColumn[];
}

export interface BatchRawMappingsResult {
  folderPath: string;
  mappings: RawMappingResult[];
  csvFileCount: number;
  totalRows: number;
}
