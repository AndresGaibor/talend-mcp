import type { IJobRepository } from "../../domain/job/job.repository";
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { createPlatformContext, detectJobRunnerStrategy, buildScriptExecutionArgs } from "../../platform";
import { getBaseNamePortable, splitPortable } from "../../platform/path-bridge";

export class RunJobUseCase {
  constructor(private jobRepo: IJobRepository) {}

  async execute(
    jobPath: string,
    context?: string
  ): Promise<RunResult> {
    const parsedJob = await this.jobRepo.parseJob(jobPath);
    const itemFileName = getBaseNamePortable(jobPath);
    const jobBaseName = itemFileName.replace(/\.item$/, "") ?? "";
    const projectPath = this.obtenerProjectPath(jobPath);

    const codeDir = join(projectPath, "code", "routines");
    const jobScriptPath = join(codeDir, jobBaseName, jobBaseName);
    const ctx = createPlatformContext();
    const strategy = detectJobRunnerStrategy(ctx);
    const scriptExt = strategy.preferredScriptPlatform === "windows" ? ".bat" : ".sh";
    const fullScriptPath = `${jobScriptPath}${scriptExt}`;

    const contextName = context ?? "Default";
    const env = { ...process.env, TALEND_CONTEXT: contextName };

    const startMs = Date.now();

    try {
      const result = await this.ejecutarScript(fullScriptPath, env, ctx, strategy);
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
    ctx: ReturnType<typeof createPlatformContext>,
    strategy: ReturnType<typeof detectJobRunnerStrategy>
  ): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
    const args = buildScriptExecutionArgs(scriptPath, strategy, ctx);
    return new Promise((resolve) => {
      const child = spawn(strategy.shell, args, { cwd: dirname(scriptPath), env, stdio: ["ignore", "pipe", "pipe"] });

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
    const parts = splitPortable(jobPath);
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