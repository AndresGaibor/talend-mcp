import type { ISnapshotRepository } from "../ports/snapshot-repository.port";
import type { Snapshot } from "../domain/snapshot.types";

export class ReadSnapshotUseCase {
  constructor(private readonly repository: ISnapshotRepository) {}

  async execute(snapshotId: string): Promise<Snapshot | null> {
    return this.repository.findById(snapshotId);
  }
}
