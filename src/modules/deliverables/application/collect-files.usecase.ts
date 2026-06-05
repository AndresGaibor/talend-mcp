import type { DeliverableFile, CollectFilesOptions } from "../domain/deliverable.types";
import type { IFileCollectorPort } from "../ports/file-collector.port";

export class CollectFilesUseCase {
  constructor(private readonly fileCollector: IFileCollectorPort) {}

  async execute(options: CollectFilesOptions): Promise<DeliverableFile[]> {
    return await this.fileCollector.collectFiles(options);
  }
}