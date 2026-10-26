export interface RunResult {
  ok: boolean;
  source: "exported-job-script" | "unknown";
  confidence: "high" | "low";
  runId: string;
  jobName: string;
  scriptPath: string;
  exitCode: number | null;
  durationMs: number;
  stdoutTail: string;
  stderrTail: string;
  logPath: string;
  error?: string;
}
