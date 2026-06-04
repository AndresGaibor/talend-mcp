import { spawn } from "node:child_process";
import { join, dirname } from "node:path";
import { existsSync, mkdirSync } from "node:fs";
import { findExportedJobScripts } from "./exported-job-finder.js";
import { saveRun } from "./run-history.js";
import type { Evidence } from "../diagnostics/types";
import { createPlatformContext, detectJobRunnerStrategy, buildScriptExecutionArgs, selectScriptByPlatform } from "../../platform";
import { toMcpPath, toTalendHostPath } from "../../platform/path-bridge";

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

function getRunsDir(): string {
  return join(process.cwd(), ".talend-mcp", "runs");
}

function generateRunId(): string {
  const now = new Date();
  const ds = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
  return `run_${ds}`;
}

export async function runExportedJob(options: {
  jobName: string;
  scriptPath?: string;
  contextName?: string;
  params?: Record<string, string>;
  timeoutMs?: number;
}): Promise<RunResult> {
  const runId = generateRunId();
  const runsDir = getRunsDir();
  mkdirSync(runsDir, { recursive: true });

  const ctx = createPlatformContext();

  let scriptPath = options.scriptPath;

  if (!scriptPath) {
    const findResult = await findExportedJobScripts({ jobName: options.jobName });
    if (!findResult.ok || !findResult.data || findResult.data.length === 0) {
      return {
        ok: false,
        source: "unknown",
        confidence: "low",
        runId,
        jobName: options.jobName,
        scriptPath: "",
        exitCode: null,
        durationMs: 0,
        stdoutTail: "",
        stderrTail: "",
        logPath: "",
        error: findResult.error ?? `No se encontró script exportado para '${options.jobName}'. Configura TALEND_BUILDS_DIR.`,
      };
    }
    const strategy = detectJobRunnerStrategy(ctx);
    const matchingScript = selectScriptByPlatform(findResult.data, strategy);
    if (!matchingScript) {
      return {
        ok: false,
        source: "unknown",
        confidence: "low",
        runId,
        jobName: options.jobName,
        scriptPath: "",
        exitCode: null,
        durationMs: 0,
        stdoutTail: "",
        stderrTail: "",
        logPath: "",
        error: `No se encontró script exportado para '${options.jobName}'.`,
      };
    }
    scriptPath = matchingScript.scriptPath;
  }

  const mcpScriptPath = toMcpPath(scriptPath, ctx);

  if (!mcpScriptPath || !existsSync(mcpScriptPath)) {
    return {
      ok: false,
      source: "unknown",
      confidence: "low",
      runId,
      jobName: options.jobName,
      scriptPath: scriptPath ?? "",
      exitCode: null,
      durationMs: 0,
      stdoutTail: "",
      stderrTail: "",
      logPath: "",
      error: `Script no encontrado: ${mcpScriptPath}`,
    };
  }

  const strategy = detectJobRunnerStrategy(ctx);
  const env = { ...process.env } as Record<string, string>;
  if (options.contextName) {
    env["TALEND_CONTEXT"] = options.contextName;
  }
  if (options.params) {
    for (const [key, value] of Object.entries(options.params)) {
      env[`TALEND_PARAM_${key}`] = value;
    }
  }

  const timeoutMs = options.timeoutMs ?? 300_000;
  const stdoutPath = join(runsDir, `${runId}.stdout.log`);
  const stderrPath = join(runsDir, `${runId}.stderr.log`);
  const startMs = Date.now();

  return new Promise<RunResult>((resolvePromise) => {
    const args = buildScriptExecutionArgs(mcpScriptPath, strategy, ctx);
    const child = spawn(strategy.shell, args, { cwd: dirname(mcpScriptPath), env, stdio: ["ignore", "pipe", "pipe"] });

    let stdout = "";
    let stderr = "";
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        killProcess(child, "SIGKILL", ctx.runtimeOs);
        finalizeRun(runsDir, runId, stdout, stderr, startMs, null, "timeout", options.jobName, scriptPath!, stdoutPath, stderrPath).then(
          (result) => resolvePromise(result),
        );
      }
    }, timeoutMs);

    child.stdout!.setEncoding("utf8");
    child.stderr!.setEncoding("utf8");
    child.stdout!.on("data", (chunk: string) => (stdout += chunk));
    child.stderr!.on("data", (chunk: string) => (stderr += chunk));
    child.on("close", async (exitCode) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        const status = exitCode === 0 ? "success" : "error";
        const result = await finalizeRun(
          runsDir,
          runId,
          stdout,
          stderr,
          startMs,
          exitCode,
          status,
          options.jobName,
          scriptPath!,
          stdoutPath,
          stderrPath,
        );
        resolvePromise(result);
      }
    });
    child.on("error", async (err) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        const result = await finalizeRunWithError(
          runsDir,
          runId,
          stdout,
          stderr,
          startMs,
          options.jobName,
          scriptPath!,
          stdoutPath,
          stderrPath,
          err.message,
        );
        resolvePromise(result);
      }
    });
  });
}

function killProcess(child: ReturnType<typeof spawn>, signal: string, runtimeOs?: string): void {
  if (child.pid === undefined) return;
  if (runtimeOs === "windows" || process.platform === "win32") {
    spawn("taskkill", ["/F", "/T", "/PID", String(child.pid)]);
  } else {
    child.kill(signal as any);
  }
}

async function finalizeRun(
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

async function finalizeRunWithError(
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
