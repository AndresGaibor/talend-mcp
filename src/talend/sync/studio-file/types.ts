export type SyncStatus = {
  ok: boolean;
  source: "mcp+studio-bridge" | "workspace-files" | "unavailable";
  confidence: "high" | "medium" | "low";
  jobOpen: boolean;
  editorDirty: boolean;
  editorTitle: string | null;
  itemPath: string | null;
  propertiesPath: string | null;
  hasSnapshot: boolean;
  snapshotPath: string | null;
  bridgeAvailable: boolean;
};

export type SyncStep = {
  name: string;
  ok: boolean;
  error?: string;
  durationMs?: number;
};

export type SyncResult = {
  ok: boolean;
  source: "mcp+studio-bridge" | "workspace-files" | "unavailable";
  confidence: "high" | "medium" | "low";
  steps: SyncStep[];
  editedFiles: string[];
  validatedWithStudio: boolean;
  snapshotPath: string | null;
  warnings?: string[];
};
