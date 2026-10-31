import { spawn } from "node:child_process";
import { join, dirname } from "node:path";
import { existsSync, mkdirSync } from "node:fs";
import { findExportedJobScripts } from "../exported-job-finder.js";
import { createPlatformContext, detectJobRunnerStrategy, buildScriptExecutionArgs, selectScriptByPlatform } from "../../../platform";
import { toMcpPath } from "../../../platform/path-bridge";
import { buildLauncherArgs } from "./launcher-args";
import { generateRunId, getRunsDir } from "./run-paths";
import { SalidaAcotada } from "../../../shared/output-buffer";
import { finalizeRun, finalizeRunWithError } from "./finalize";
import type { RunResult } from "./types";

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
  // El launcher llama a `java` por nombre: si hace falta un JDK concreto (el de Studio, por ejemplo),
  // se pone delante en el PATH del proceso.
  if (process.env.TALEND_JAVA_HOME) {
    // En Windows la variable se llama `Path`, sin distinguir mayusculas: se reusa la clave que ya exista.
    const pathKey = Object.keys(env).find((key) => key.toUpperCase() === "PATH") ?? "PATH";
    const separador = process.platform === "win32" ? ";" : ":";
    env[pathKey] = `${join(process.env.TALEND_JAVA_HOME, "bin")}${separador}${env[pathKey] ?? ""}`;
  }
  const launcherArgs = buildLauncherArgs({ contextName: options.contextName, params: options.params });

  const timeoutMs = options.timeoutMs ?? 300_000;
  const stdoutPath = join(runsDir, `${runId}.stdout.log`);
  const stderrPath = join(runsDir, `${runId}.stderr.log`);
  const startMs = Date.now();

  return new Promise<RunResult>((resolvePromise) => {
    const args = buildScriptExecutionArgs(mcpScriptPath, strategy, ctx, launcherArgs);
    const child = spawn(strategy.shell, args, { cwd: dirname(mcpScriptPath), env, stdio: ["ignore", "pipe", "pipe"] });

    const stdout = new SalidaAcotada();
    const stderr = new SalidaAcotada();
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        killProcess(child, "SIGKILL", ctx.runtimeOs);
        finalizeRun(runsDir, runId, stdout.value, stderr.value, startMs, null, "timeout", options.jobName, scriptPath!, stdoutPath, stderrPath).then(
          (result) => resolvePromise(result),
        );
      }
    }, timeoutMs);

    child.stdout!.setEncoding("utf8");
    child.stderr!.setEncoding("utf8");
    child.stdout!.on("data", (chunk: string) => stdout.append(chunk));
    child.stderr!.on("data", (chunk: string) => stderr.append(chunk));
    child.on("close", async (exitCode) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        const status = exitCode === 0 ? "success" : "error";
        const result = await finalizeRun(
          runsDir,
          runId,
          stdout.value,
          stderr.value,
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
          stdout.value,
          stderr.value,
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
