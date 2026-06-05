import type { Snapshot, SnapshotMetadata, CreateSnapshotOptions, ListSnapshotsOptions } from "../domain/snapshot.types";

export interface ISnapshotRepository {
  list(options?: ListSnapshotsOptions): Promise<Snapshot[]>;
  findById(id: string): Promise<Snapshot | null>;
  create(options: CreateSnapshotOptions): Promise<Snapshot>;
  delete(id: string): Promise<void>;
  restore(id: string, targetPath?: string, overwrite?: boolean): Promise<void>;
  getDiff(snapshotIdA: string, snapshotIdB: string): Promise<string>;
  exists(id: string): Promise<boolean>;
}

export interface ISnapshotMetadataStore {
  save(metadata: SnapshotMetadata): Promise<void>;
  findById(id: string): Promise<SnapshotMetadata | null>;
  list(sourcePath?: string, limit?: number, offset?: number): Promise<SnapshotMetadata[]>;
  delete(id: string): Promise<void>;
  update(id: string, updates: Partial<SnapshotMetadata>): Promise<void>;
}
