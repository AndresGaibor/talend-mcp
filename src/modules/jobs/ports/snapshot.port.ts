import type { Snapshot } from "../../snapshots/domain/snapshot.types";
import type { CreateSnapshotOptions, RestoreSnapshotOptions } from "../../snapshots/domain/snapshot.types";

export interface ISnapshotPort {
  createSnapshot(options: CreateSnapshotOptions): Promise<Snapshot>;
  restoreSnapshot(options: RestoreSnapshotOptions): Promise<void>;
  listSnapshots(sourcePath?: string): Promise<Snapshot[]>;
}