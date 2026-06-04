import type { PlatformContext } from "./runtime";
import { toTalendHostPath } from "./path-bridge";

export type ScriptPlatform = "posix" | "windows";

export type JobRunnerStrategy = {
  shell: string;
  shellArgs: string[];
  preferredScriptPlatform: ScriptPlatform;
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

export function buildScriptExecutionArgs(
  scriptPath: string,
  strategy: JobRunnerStrategy,
  ctx: PlatformContext,
): string[] {
  if (strategy.shell === "cmd.exe") {
    const windowsPath = toTalendHostPath(scriptPath, ctx);
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
