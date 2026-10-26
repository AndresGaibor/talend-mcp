/** Tipos publicos del cliente HTTP del bridge de Talend Studio. */

export type BridgeSource = "studio-bridge" | "workspace-files" | "unavailable";

export type BridgeConfidence = "high" | "medium" | "low";

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
  unsafeActions?: boolean;
  /** Proceso de Studio que sirve el bridge, y cuanto lleva arriba la version actual. */
  pid?: number;
  javaVersion?: string;
  startedAt?: number;
  uptimeMs?: number;
};

/** Ultimas lineas del Error Log de Talend Studio (`/logs/tail`). */
export type BridgeLogTail = {
  available: boolean;
  file?: string;
  truncated?: boolean;
  lines: string[];
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

/** Opciones internas de una peticion al bridge. */
export type BridgeRequestInit = {
  method?: "GET" | "POST";
  body?: unknown;
  allowUnauthenticated?: boolean;
  /** Timeout de esta peticion; por defecto el del cliente. Las operaciones largas (build) lo suben. */
  timeoutMs?: number;
};
