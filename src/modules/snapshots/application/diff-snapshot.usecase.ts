import type { SnapshotDiff } from "../domain/snapshot.types";
import type { ISnapshotRepository } from "../ports/snapshot-repository.port";

export class DiffSnapshotUseCase {
  constructor(private readonly repository: ISnapshotRepository) {}

  async execute(snapshotIdA: string, snapshotIdB: string): Promise<SnapshotDiff> {
    const snapshotA = await this.repository.findById(snapshotIdA);
    const snapshotB = await this.repository.findById(snapshotIdB);

    if (!snapshotA) {
      throw new Error(`Snapshot not found: ${snapshotIdA}`);
    }
    if (!snapshotB) {
      throw new Error(`Snapshot not found: ${snapshotIdB}`);
    }

    const diffContent = await this.repository.getDiff(snapshotIdA, snapshotIdB);

    return {
      snapshotA,
      snapshotB,
      addedFiles: [],
      removedFiles: [],
      modifiedFiles: [],
      diffContent,
    };
  }
}
