export interface CsvMapping {
  csvFile: string;
  targetTable: string;
  columns: Array<{ name: string; type?: string }>;
}

export interface MultiCsvOptions {
  mappings: CsvMapping[];
  inputPath: string;
  batchSize: number;
  technicalColumns?: Array<{ name: string; value: string }>;
  appendMode?: boolean;
}
