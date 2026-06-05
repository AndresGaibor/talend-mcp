import { join } from "node:path";
import type { ICsvReader } from "../ports/csv-reader.port";
import type { IFileSystem } from "../ports/file-system.port";
import type { CsvFolderInspection, DatasetInspectionResult } from "../domain/dataset.types";

export class InspectCsvFolderUseCase {
  constructor(
    private csvReader: ICsvReader,
    private fileSystem: IFileSystem,
  ) {}

  async execute(folderPath: string): Promise<DatasetInspectionResult> {
    const start = Date.now();

    const entries = await this.fileSystem.readdir(folderPath, { withFileTypes: true });
    const csvFiles = entries.filter((e) => e.isFile() && e.name.toLowerCase().endsWith(".csv"));

    const files: CsvFolderInspection["files"] = [];
    let totalRows = 0;
    let totalColumns = 0;

    for (const entry of csvFiles) {
      const filePath = join(folderPath, entry.name);
      const info = await this.csvReader.readCsvFile(filePath, folderPath);
      if (info) {
        files.push(info);
        totalRows += info.rowCount;
        totalColumns += info.columns.length;
      }
    }

    const schemaFingerprint = `cols_${totalColumns}_rows_${totalRows}_${new Date().toISOString().slice(0, 10)}`;

    return {
      folderPath,
      files,
      totalRows,
      totalColumns,
      schemaFingerprint,
      csvFileCount: files.length,
    };
  }
}
