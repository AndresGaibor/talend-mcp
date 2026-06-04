import type { RunRecord, PerformanceMeasurement, RunComparison } from "./performance-types";

export interface JobRunOptions {
  jobName: string;
  dryRun?: boolean;
  saveBefore?: boolean;
  waitForTermination?: boolean;
  timeoutMs?: number;
}

export interface RunResult {
  ok: boolean;
  launched: boolean;
  launchId?: string;
  status?: string;
  durationMs?: number;
  exitCode?: number;
  problemsCount?: number;
}

export function recordRun(runRecord: RunRecord): void {
  // TODO: implementar persistencia de runs
  // Por ahora solo kept in memory en LaunchTrackerService del plugin
}

export function getRecentRuns(count = 10): RunRecord[] {
  // TODO: implementar recuperación de runs desde el plugin
  return [];
}

export function measurePerformance(run: RunRecord, targetMs?: number): PerformanceMeasurement {
  const meetsTarget = targetMs ? (run.durationMs ?? Infinity) <= targetMs : true;
  return {
    jobName: run.jobName,
    runId: run.launchId,
    durationMs: run.durationMs ?? 0,
    meetsTarget,
    targetMs: targetMs,
  };
}

export function compareRuns(runs: RunRecord[]): RunComparison {
  const durations = runs
    .filter((r) => r.durationMs !== undefined)
    .map((r) => r.durationMs!);

  const fastest = durations.length > 0 ? Math.min(...durations) : undefined;
  const slowest = durations.length > 0 ? Math.max(...durations) : undefined;
  const avg = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : undefined;

  let trend: "improving" | "degrading" | "stable" = "stable";
  if (durations.length >= 3) {
    const recent = durations.slice(0, Math.ceil(durations.length / 3));
    const older = durations.slice(Math.ceil(durations.length / 3));
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
    if (recentAvg < olderAvg * 0.9) trend = "improving";
    else if (recentAvg > olderAvg * 1.1) trend = "degrading";
  }

  return {
    jobName: runs[0]?.jobName ?? "unknown",
    runs,
    fastestMs: fastest,
    slowestMs: slowest,
    avgMs: avg,
    trend,
  };
}
