export interface LaunchConfig {
  id: string;
  name: string;
  jobName: string;
  description?: string;
  createdAt: string;
  lastUsed?: string;
}

export interface RunStatus {
  runId: string;
  status: "STARTING" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELLED" | "UNKNOWN";
  startTime?: string;
  endTime?: string;
  duration?: number;
  errorCount?: number;
  warningCount?: number;
}

export interface LogEntry {
  timestamp: string;
  level: "INFO" | "WARN" | "ERROR" | "DEBUG";
  message: string;
  source?: string;
}

export interface TimelineEvent {
  timestamp: string;
  event: string;
  details?: string;
}

export interface RunOutput {
  name: string;
  path: string;
  size?: number;
  type?: string;
}

export interface ExecutionRun {
  runId: string;
  jobName: string;
  configId?: string;
  status: RunStatus["status"];
  startTime?: string;
  endTime?: string;
  duration?: number;
  logs: LogEntry[];
  events: TimelineEvent[];
  outputs: RunOutput[];
  errorCount?: number;
  warningCount?: number;
}

export interface ExecutionCenterState {
  launchConfigs: LaunchConfig[];
  recentRuns: ExecutionRun[];
  selectedRun: ExecutionRun | null;
  isLoading: boolean;
  error: string | null;
}
