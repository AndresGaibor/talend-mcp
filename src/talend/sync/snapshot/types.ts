export type SnapshotManifest = {
  snapshotId: string;
  createdAt: number;
  jobName: string;
  itemPath: string;
  propertiesPath: string;
  files: Array<{
    original: string;
    backup: string;
  }>;
  reason: string;
};

export type SnapshotInfo = {
  snapshotId: string;
  createdAt: number;
  jobName: string;
  reason: string;
  itemPath: string;
  propertiesPath: string;
  manifestPath: string;
};
