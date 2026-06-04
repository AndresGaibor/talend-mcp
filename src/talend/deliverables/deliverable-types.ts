export interface DeliverableFile {
  path: string;
  type: "job" | "context" | "schema" | "script" | "readme" | "other";
  description?: string;
  sizeBytes?: number;
}

export interface DeliverablePackage {
  jobName: string;
  files: DeliverableFile[];
  zipPath?: string;
  createdAt: number;
  totalSizeBytes?: number;
}

export interface ChecklistItem {
  id: string;
  description: string;
  checked: boolean;
  required: boolean;
}

export interface DeliverableChecklist {
  jobName: string;
  items: ChecklistItem[];
  allChecked: boolean;
  missingRequired: string[];
}
