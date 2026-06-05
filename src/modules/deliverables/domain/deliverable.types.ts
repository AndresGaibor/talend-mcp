export type DeliverableFile = {
  path: string;
  name: string;
  sizeBytes: number;
  type: string;
  modifiedAt: Date;
};

export type DeliverablePackage = {
  id: string;
  name: string;
  version: string;
  files: DeliverableFile[];
  totalSizeBytes: number;
  createdAt: Date;
  checksum: string;
};

export type ChecklistItem = {
  id: string;
  label: string;
  description: string;
  required: boolean;
  checked: boolean;
  severity: "error" | "warning" | "info";
};

export type Checklist = {
  id: string;
  name: string;
  items: ChecklistItem[];
  passed: boolean;
  validatedAt?: Date;
};

export type ExportJob = {
  id: string;
  name: string;
  status: "pending" | "running" | "completed" | "failed";
  startedAt: Date;
  completedAt?: Date;
  destination: string;
  packageId?: string;
  progress: number;
};

export type CollectFilesOptions = {
  jobId: string;
  sourcePath: string;
  patterns?: string[];
  includeMetadata?: boolean;
};

export type ValidateChecklistOptions = {
  checklistId: string;
  items: ChecklistItem[];
};

export type CreatePackageOptions = {
  name: string;
  version: string;
  files: DeliverableFile[];
  requiresConfirmation?: boolean;
};

export type ExportJobOptions = {
  jobId: string;
  packageId: string;
  destination: string;
  format?: "zip" | "tar.gz" | "directory";
};