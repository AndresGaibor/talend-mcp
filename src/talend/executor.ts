import { spawn } from "node:child_process";
import { join, dirname } from "node:path";
import { getConfiguredProjectPath } from "./workspace";
import { listJobs } from "./repository";
import { readTextFile } from "./files";
import { createPlatformContext, detectJobRunnerStrategy, buildScriptExecutionArgs } from "../platform";
import { getBaseNamePortable } from "../platform/path-bridge";

export interface RunResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  durationMs: number;
  error?: string;
}

export interface RunJobOptions {
  jobName?: string;
  contextName?: string;
  timeoutMs?: number;
  params?: Record<string, string>;
}

function killProcess(child: ReturnType<typeof spawn>, signal: string): void {
  if (child.pid === undefined) return;
  if (process.platform === "win32") {
    spawn("taskkill", ["/F", "/T", "/PID", String(child.pid)]);
  } else {
    child.kill(signal as any);
  }
}

export async function runJob(options: RunJobOptions): Promise<RunResult> {
  const projectPath = getConfiguredProjectPath();
  if (!projectPath) {
    return { ok: false, stdout: "", stderr: "", exitCode: null, durationMs: 0, error: "No se detectó TALEND_PROJECT." };
  }

  const jobs = await listJobs(projectPath);
  const target = options.jobName ? jobs.find((j) => j.label === options.jobName) : jobs[0];
  if (!target) {
    return { ok: false, stdout: "", stderr: "", exitCode: null, durationMs: 0, error: `Job no encontrado: ${options.jobName}` };
  }

  const contextName = options.contextName ?? "Default";
  const jobScriptPath = resolveJobScriptPath(target.itemPath, projectPath);
  const ctx = createPlatformContext();
  const strategy = detectJobRunnerStrategy(ctx);
  const scriptExt = strategy.preferredScriptPlatform === "windows" ? ".bat" : ".sh";
  const fullScriptPath = `${jobScriptPath}${scriptExt}`;

  const env = { ...process.env };
  if (options.params) {
    for (const [key, value] of Object.entries(options.params)) {
      env[`TALEND_PARAM_${key}`] = value;
    }
  }
  env["TALEND_CONTEXT"] = contextName;

  const startMs = Date.now();
  const timeoutMs = options.timeoutMs ?? 300_000;

  return new Promise<RunResult>((resolve) => {
    const args = buildScriptExecutionArgs(fullScriptPath, strategy, ctx);
    const child = spawn(strategy.shell, args, { cwd: dirname(fullScriptPath), env, stdio: ["ignore", "pipe", "pipe"] });

    let stdout = "";
    let stderr = "";
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        killProcess(child, "SIGKILL");
        resolve({ ok: false, stdout, stderr, exitCode: null, durationMs: Date.now() - startMs, error: `Timeout exceeded: ${timeoutMs}ms` });
      }
    }, timeoutMs);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("close", (exitCode) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve({ ok: exitCode === 0, stdout, stderr, exitCode, durationMs: Date.now() - startMs });
      }
    });
    child.on("error", (err) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve({ ok: false, stdout, stderr, exitCode: null, durationMs: Date.now() - startMs, error: err.message });
      }
    });
  });
}

function resolveJobScriptPath(itemPath: string, projectPath: string): string {
  const codeDir = join(projectPath, "code", "routines");
  const itemFileName = getBaseNamePortable(itemPath);
  const jobBaseName = itemFileName.replace(/\.item$/, "");
  return join(codeDir, jobBaseName, jobBaseName);
}

export async function getJobExecutionInfo(jobName?: string): Promise<{
  itemPath: string;
  propertiesPath: string;
  scriptPath: string;
  exists: boolean;
} | null> {
  const projectPath = getConfiguredProjectPath();
  if (!projectPath) return null;

  const jobs = await listJobs(projectPath);
  const target = jobName ? jobs.find((j) => j.label === jobName) : jobs[0];
  if (!target) return null;

  const ctx = createPlatformContext();
  const strategy = detectJobRunnerStrategy(ctx);
  const scriptExt = strategy.preferredScriptPlatform === "windows" ? ".bat" : ".sh";
  const jobScriptPath = resolveJobScriptPath(target.itemPath, projectPath);
  const fullScriptPath = `${jobScriptPath}${scriptExt}`;

  return {
    itemPath: target.itemPath,
    propertiesPath: target.propertiesPath,
    scriptPath: fullScriptPath,
    exists: true,
  };
}