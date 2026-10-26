import { join } from "node:path";
import { saveRun } from "../run-history.js";
import type { RunResult } from "./types";

export async function finalizeRun(
  runsDir: string,
  runId: string,
  stdout: string,
  stderr: string,
  startMs: number,
  exitCode: number | null,
  status: string,
  jobName: string,
  scriptPath: string,
  stdoutPath: string,
  stderrPath: string,
): Promise<RunResult> {
  const durationMs = Date.now() - startMs;
  const stdoutTail = stdout.split("\n").slice(-20).join("\n");
  const stderrTail = stderr.split("\n").slice(-20).join("\n");

  await Bun.write(stdoutPath, stdout);
  await Bun.write(stderrPath, stderr);

  await saveRun({
    runId,
    jobName,
    scriptPath,
    startedAt: new Date(startMs).toISOString(),
    finishedAt: new Date().toISOString(),
    status: status as "success" | "error" | "timeout",
    exitCode,
    durationMs,
    stdoutPath,
    stderrPath,
  });

  const logPath = join(runsDir, `${runId}.log`);
  await Bun.write(logPath, `STDOUT:\n${stdout}\n\nSTDERR:\n${stderr}`);

  return {
    ok: exitCode === 0,
    source: "exported-job-script",
    confidence: "high",
    runId,
    jobName,
    scriptPath,
    exitCode,
    durationMs,
    stdoutTail,
    stderrTail,
    logPath,
  };
}

export async function finalizeRunWithError(
  runsDir: string,
  runId: string,
  stdout: string,
  stderr: string,
  startMs: number,
  jobName: string,
  scriptPath: string,
  stdoutPath: string,
  stderrPath: string,
  errorMessage: string,
): Promise<RunResult> {
  const durationMs = Date.now() - startMs;
  await Bun.write(stdoutPath, stdout);
  await Bun.write(stderrPath, stderr);

  await saveRun({
    runId,
    jobName,
    scriptPath,
    startedAt: new Date(startMs).toISOString(),
    finishedAt: new Date().toISOString(),
    status: "error",
    exitCode: null,
    durationMs,
    stdoutPath,
    stderrPath,
  });

  return {
    ok: false,
    source: "unknown",
    confidence: "low",
    runId,
    jobName,
    scriptPath,
    exitCode: null,
    durationMs,
    stdoutTail: stdout.split("\n").slice(-5).join("\n"),
    stderrTail: stderr.split("\n").slice(-5).join("\n"),
    logPath: "",
    error: errorMessage,
  };
}
