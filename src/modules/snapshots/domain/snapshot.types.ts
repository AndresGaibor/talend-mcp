export type Snapshot = {
  id: string;
  name: string;
  path: string;
  createdAt: Date;
  sizeBytes: number;
  description?: string;
  tags?: string[];
  sourcePath: string;
};

export type SnapshotMetadata = {
  id: string;
  name: string;
  createdAt: string;
  sizeBytes: number;
  description: string;
  tags: string[];
  sourcePath: string;
};

export type SnapshotDiff = {
  snapshotA: Snapshot;
  snapshotB: Snapshot;
  addedFiles: string[];
  removedFiles: string[];
  modifiedFiles: string[];
  diffContent: string;
};

export type CreateSnapshotOptions = {
  name: string;
  sourcePath: string;
  description?: string;
  tags?: string[];
};

export type ListSnapshotsOptions = {
  sourcePath?: string;
  limit?: number;
  offset?: number;
};

export type RestoreSnapshotOptions = {
  snapshotId: string;
  targetPath?: string;
  overwrite?: boolean;
};

export type SnapshotSafetyConfig = {
  readOnly: boolean;
  destructive: boolean;
  requiresConfirmation: boolean;
};
