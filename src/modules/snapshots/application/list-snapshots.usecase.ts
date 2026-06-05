import type { Snapshot, ListSnapshotsOptions } from "../domain/snapshot.types";
import type { ISnapshotRepository } from "../ports/snapshot-repository.port";

export class ListSnapshotsUseCase {
  constructor(private readonly repository: ISnapshotRepository) {}

  async execute(options?: ListSnapshotsOptions): Promise<Snapshot[]> {
    return await this.repository.list(options);
  }
}
