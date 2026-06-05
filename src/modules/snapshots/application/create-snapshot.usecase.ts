import type { Snapshot, CreateSnapshotOptions } from "../domain/snapshot.types";
import type { ISnapshotRepository } from "../ports/snapshot-repository.port";

export class CreateSnapshotUseCase {
  constructor(private readonly repository: ISnapshotRepository) {}

  async execute(options: CreateSnapshotOptions): Promise<Snapshot> {
    return await this.repository.create(options);
  }
}
