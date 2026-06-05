export type BridgeSource = "studio-bridge" | "workspace-files" | "unavailable";

export type BridgeConfidence = "high" | "medium" | "low";

export type BridgeConfig = {
  host: string;
  port: number;
  readOnly: boolean;
  unsafeActions: boolean;
  allowAllCommands: boolean;
  allowCommands: string[];
  timeoutMs: number;
};

export type BridgeError = {
  code: string;
  message: string;
  details?: Record<string, unknown>;
};

export type BridgeResult<T> = {
  ok: boolean;
  source: BridgeSource;
  confidence: BridgeConfidence;
  endpoint: string;
  status?: number;
  data?: T;
  error?: BridgeError;
  rawText?: string;
};

export type BridgePingPayload = {
  ok: true;
  plugin: string;
  version: string;
  mode: string;
};

export type BridgeCommand = {
  id: string;
  name?: string;
  defined?: boolean;
  enabled?: boolean;
  category?: string;
};

export type BridgeLaunchConfig = {
  name?: string;
  type?: string;
  path?: string;
  attributes?: Record<string, string>;
};

export type BridgeWorkbenchState = {
  windows?: Array<Record<string, unknown>>;
  source?: string;
  confidence?: BridgeConfidence;
};

export type BridgeCapabilities = {
  ok: true;
  capabilities?: Record<string, unknown>;
  limitations?: string[];
};

export type BridgeEnvironment = {
  ok: true;
  java?: Record<string, unknown>;
  osgi?: Record<string, unknown>;
  eclipse?: Record<string, unknown>;
  talend?: Record<string, unknown>;
};

export type BridgeActiveJobModel = {
  ok: true;
  job?: Record<string, unknown>;
  components?: Array<Record<string, unknown>>;
  connections?: Array<Record<string, unknown>>;
  source?: string;
  confidence?: BridgeConfidence;
  unsupported?: string[];
};

export type BridgeLaunchRun = {
  id: string;
  name: string;
  status: string;
  startTime: string;
  endTime?: string;
};

export type BridgeProblemMarker = {
  id: string;
  severity: string;
  message: string;
  path?: string;
  line?: number;
};

export type BridgeWorkspaceState = {
  projects?: Array<{ name: string; path: string }>;
  openedFiles?: string[];
  selectedResource?: string;
};