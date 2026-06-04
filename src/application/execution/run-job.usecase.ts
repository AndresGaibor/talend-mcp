import type { IJobRepository } from "../../domain/job/job.repository";
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";

export class RunJobUseCase {
  constructor(private jobRepo: IJobRepository) {}

  async execute(
    jobPath: string,
    context?: string
  ): Promise<RunResult> {
    const parsedJob = await this.jobRepo.parseJob(jobPath);
    const jobBaseName = jobPath.split("/").pop()?.replace(".item", "") ?? "";
    const projectPath = this.obtenerProjectPath(jobPath);

    const codeDir = join(projectPath, "code", "routines");
    const jobScriptPath = join(codeDir, jobBaseName, jobBaseName);
    const isWindows = process.platform === "win32";
    const scriptExt = isWindows ? ".bat" : ".sh";
    const fullScriptPath = `${jobScriptPath}${scriptExt}`;

    const contextName = context ?? "Default";
    const env = { ...process.env, TALEND_CONTEXT: contextName };

    const startMs = Date.now();

    try {
      const result = await this.ejecutarScript(fullScriptPath, env, isWindows);
      const durationMs = Date.now() - startMs;

      return {
        success: result.exitCode === 0,
        logPath: this.construirLogPath(projectPath, jobBaseName),
        exitCode: result.exitCode ?? undefined,
        error: result.stderr || undefined,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  private ejecutarScript(
    scriptPath: string,
    env: Record<string, string | undefined>,
    isWindows: boolean
  ): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
    return new Promise((resolve) => {
      const child = spawn(
        isWindows ? "cmd.exe" : "/bin/sh",
        isWindows ? ["/C", scriptPath] : ["-c", `chmod +x "${scriptPath}" && "${scriptPath}"`],
        { cwd: dirname(scriptPath), env, stdio: ["ignore", "pipe", "pipe"] }
      );

      let stdout = "";
      let stderr = "";

      child.stdout?.on("data", (chunk) => (stdout += chunk));
      child.stderr?.on("data", (chunk) => (stderr += chunk));

      child.on("close", (exitCode) => {
        resolve({ stdout, stderr, exitCode });
      });

      child.on("error", (err) => {
        resolve({ stdout, stderr, exitCode: null });
      });
    });
  }

  private obtenerProjectPath(jobPath: string): string {
    const parts = jobPath.split("/");
    const idx = parts.findIndex((p) => p === "workspace" || p === "projects");
    if (idx > 0 && parts[idx + 1]) {
      return parts.slice(0, idx + 2).join("/");
    }
    return parts.slice(0, -2).join("/");
  }

  private construirLogPath(projectPath: string, jobBaseName: string): string {
    return join(projectPath, "logs", `${jobBaseName}.log`);
  }
}

export interface RunResult {
  success: boolean;
  logPath?: string;
  exitCode?: number;
  error?: string;
}