export interface RunRecord {
  launchId: string;
  jobName: string;
  launchConfigName: string;
  status: "started" | "success" | "failed" | "terminated_without_exit_code";
  startedAt: number;
  terminatedAt?: number;
  durationMs?: number;
  exitCode?: number;
  problemsCount?: number;
}

export interface PerformanceMeasurement {
  jobName: string;
  runId: string;
  durationMs: number;
  rowsProcessed?: number;
  batchSize?: number;
  meetsTarget: boolean;
  targetMs?: number;
}

export interface RunComparison {
  jobName: string;
  runs: RunRecord[];
  fastestMs?: number;
  slowestMs?: number;
  avgMs?: number;
  trend: "improving" | "degrading" | "stable";
}
