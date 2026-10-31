import { spawn } from "node:child_process";
import type { PlatformContext } from "./runtime";
import { toTalendHostPath, toMcpPath } from "./path-bridge";
import { SalidaAcotada } from "../shared/output-buffer";

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

/**
 * Argumentos para lanzar un script. `extraArgs` llega al script como argumentos (el launcher de Talend
 * los reenvia a Java con `%*` o `"$@"`): asi es como se pasan `--context=` y `--context_param`.
 */
export function buildScriptExecutionArgs(
  scriptPath: string,
  strategy: JobRunnerStrategy,
  ctx: PlatformContext,
  extraArgs: string[] = [],
): string[] {
  if (strategy.shell === "cmd.exe") {
    const windowsPath = getScriptPathForCmd(scriptPath, ctx);
    return ["/C", windowsPath, ...extraArgs];
  }
  const quoted = extraArgs.map(shellQuote).join(" ");
  return ["-c", `chmod +x "${scriptPath}" && "${scriptPath}"${quoted ? ` ${quoted}` : ""}`];
}

/** Entrecomilla un argumento para sh: sin expansion y con las comillas simples escapadas. */
function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
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
  const timeoutMs = options?.timeoutMs ?? 300_000;

  return new Promise<RunResult>((resolve) => {
    const stdout = new SalidaAcotada();
    const stderr = new SalidaAcotada();

    const child = spawn(strategy.shell, args, { stdio: ["ignore", "pipe", "pipe"] });
    let settled = false;

    const terminar = (resultado: RunResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(resultado);
    };

    const timer = setTimeout(() => {
      // En Windows `child.kill()` no mata el arbol de procesos del script: el
      // job seguiria escribiendo en las tuberias y gastando memoria.
      if (child.pid !== undefined && (ctx.runtimeOs === "windows" || process.platform === "win32")) {
        spawn("taskkill", ["/F", "/T", "/PID", String(child.pid)]);
      } else {
        child.kill("SIGKILL");
      }
      terminar({ ok: false, exitCode: null, stdout: stdout.value, stderr: stderr.value, error: `Timeout: ${timeoutMs}ms` });
    }, timeoutMs);

    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (chunk: string) => stdout.append(chunk));
    child.stderr?.on("data", (chunk: string) => stderr.append(chunk));

    child.on("close", (exitCode) => {
      terminar({ ok: exitCode === 0, exitCode, stdout: stdout.value, stderr: stderr.value });
    });

    child.on("error", (err) => {
      terminar({ ok: false, exitCode: null, stdout: stdout.value, stderr: stderr.value, error: err.message });
    });
  });
}
