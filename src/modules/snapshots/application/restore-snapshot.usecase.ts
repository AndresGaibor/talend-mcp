import type { RestoreSnapshotOptions } from "../domain/snapshot.types";
import type { ISnapshotRepository } from "../ports/snapshot-repository.port";

export class RestoreSnapshotUseCase {
  constructor(private readonly repository: ISnapshotRepository) {}

  async execute(options: RestoreSnapshotOptions): Promise<void> {
    const exists = await this.repository.exists(options.snapshotId);
    if (!exists) {
      throw new Error(`Snapshot not found: ${options.snapshotId}`);
    }
    await this.repository.restore(
      options.snapshotId,
      options.targetPath,
      options.overwrite
    );
  }
}
