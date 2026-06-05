import { spawn } from "node:child_process";
import type { PlatformContext } from "./runtime";
import { toTalendHostPath, toMcpPath } from "./path-bridge";

export type ScriptPlatform = "posix" | "windows";

export type JobRunnerStrategy = {
  shell: string;
  shellArgs: string[];
  preferredScriptPlatform: ScriptPlatform;
};

export type RunResult = {
  ok: boolean;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  error?: string;
};

export function detectJobRunnerStrategy(ctx: PlatformContext): JobRunnerStrategy {
  if (ctx.talendHostOs === "windows") {
    return {
      shell: "cmd.exe",
      shellArgs: ["/C"],
      preferredScriptPlatform: "windows",
    };
  }
  return {
    shell: "/bin/sh",
    shellArgs: ["-c"],
    preferredScriptPlatform: "posix",
  };
}

export function getScriptPathForExistsSync(scriptPath: string, ctx: PlatformContext): string {
  if (ctx.pathMode === "wsl-windows") {
    return toMcpPath(scriptPath, ctx);
  }
  return scriptPath;
}

export function getScriptPathForCmd(scriptPath: string, ctx: PlatformContext): string {
  if (ctx.pathMode === "wsl-windows") {
    return toTalendHostPath(scriptPath, ctx);
  }
  return scriptPath;
}

export function buildScriptExecutionArgs(
  scriptPath: string,
  strategy: JobRunnerStrategy,
  ctx: PlatformContext,
): string[] {
  if (strategy.shell === "cmd.exe") {
    const windowsPath = getScriptPathForCmd(scriptPath, ctx);
    return ["/C", windowsPath];
  }
  return ["-c", `chmod +x "${scriptPath}" && "${scriptPath}"`];
}

export function selectScriptByPlatform(
  scripts: Array<{ platform: string; scriptPath: string }>,
  strategy: JobRunnerStrategy,
): { platform: string; scriptPath: string } | undefined {
  const preferred = scripts.find((s) => s.platform === strategy.preferredScriptPlatform);
  if (preferred) return preferred;
  return scripts[0];
}

export async function executeJob(
  jobPath: string,
  strategy: JobRunnerStrategy,
  ctx: PlatformContext,
  options?: { timeoutMs?: number },
): Promise<RunResult> {
  const args = buildScriptExecutionArgs(jobPath, strategy, ctx);

  return new Promise<RunResult>((resolve) => {
    let stdout = "";
    let stderr = "";

    const child = spawn(strategy.shell, args, { stdio: ["ignore", "pipe", "pipe"] });

    const timeoutMs = options?.timeoutMs ?? 300_000;
    const timer = setTimeout(() => {
      child.kill();
      resolve({ ok: false, exitCode: null, stdout, stderr, error: "timeout" });
    }, timeoutMs);

    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (chunk: string) => (stdout += chunk));
    child.stderr?.on("data", (chunk: string) => (stderr += chunk));

    child.on("close", (exitCode) => {
      clearTimeout(timer);
      resolve({ ok: exitCode === 0, exitCode, stdout, stderr });
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({ ok: false, exitCode: null, stdout, stderr, error: err.message });
    });
  });
}
