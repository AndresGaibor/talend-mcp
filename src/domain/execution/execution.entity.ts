export type RunLogStatus = "success" | "error" | "unknown";

export type RunLogEntry = {
  timestamp?: string;
  line: number;
  message: string;
};

export type LatestRunLog = {
  jobName: string;
  status: RunLogStatus;
  latestCommand?: RunLogEntry;
  latestError?: RunLogEntry;
  errors: RunLogEntry[];
};

export type RunRecord = {
  jobName: string;
  startTime: string;
  endTime?: string;
  status: RunLogStatus;
  exitCode?: number;
};

export type PerformanceMeasurement = {
  jobName: string;
  durationMs: number;
  componentCount: number;
  rowCount?: number;
};