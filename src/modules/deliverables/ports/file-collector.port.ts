import type { DeliverableFile, CollectFilesOptions } from "../domain/deliverable.types";

export interface IFileCollectorPort {
  collectFiles(options: CollectFilesOptions): Promise<DeliverableFile[]>;
  scanDirectory(path: string, patterns?: string[]): Promise<DeliverableFile[]>;
  getFileInfo(path: string): Promise<DeliverableFile>;
}