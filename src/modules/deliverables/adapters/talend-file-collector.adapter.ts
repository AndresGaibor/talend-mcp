import { basename } from "node:path";
import type { DeliverableFile, CollectFilesOptions } from "../domain/deliverable.types";
import type { IFileCollectorPort } from "../ports/file-collector.port";

export class TalendFileCollectorAdapter implements IFileCollectorPort {
  async collectFiles(options: CollectFilesOptions): Promise<DeliverableFile[]> {
    return this.scanDirectory(options.sourcePath, options.patterns);
  }

  async scanDirectory(path: string, _patterns?: string[]): Promise<DeliverableFile[]> {
    const file = Bun.file(path);
    if (await file.exists()) {
      const stat = await file.stat();
      return [{
        path,
        name: basename(path),
        sizeBytes: stat.size,
        type: this.getFileType(path),
        modifiedAt: stat.mtime,
      }];
    }
    return [];
  }

  async getFileInfo(path: string): Promise<DeliverableFile> {
    const file = Bun.file(path);
    const stat = await file.stat();
    return {
      path,
      name: basename(path),
      sizeBytes: stat.size,
      type: this.getFileType(path),
      modifiedAt: stat.mtime,
    };
  }

  private getFileType(path: string): string {
    const ext = path.split(".").pop() ?? "";
    return ext;
  }
}