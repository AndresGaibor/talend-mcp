import type { CsvFileInfo, CsvFolderInspection } from "../domain/dataset.types";

export interface ICsvReader {
  readCsvFile(filePath: string, basePath: string): Promise<CsvFileInfo | null>;
}

export interface InspectCsvFolderResult {
  inspection: CsvFolderInspection;
  durationMs: number;
}
