import { loadBridge } from "./tools-base";
import type { TalendStudioBridgeClient } from "./bridge-client";

export interface RunInfo {
  id: string;
  jobName: string;
  status: string;
  startTime: number;
  endTime: number;
  duration: number;
  exitCode?: number;
  errors?: string[];
}

export interface RunDetails extends RunInfo {
  logs: string[];
  outputs: string[];
  metrics?: Record<string, number>;
}

export interface EvidencePackage {
  runId: string;
  summary: string;
  logs: string[];
  outputs: string[];
  generatedAt: number;
  duration: number;
  status: string;
}

class ExecutionTrackerService {
  private bridge: TalendStudioBridgeClient | null = null;

  private async getBridge(): Promise<TalendStudioBridgeClient> {
    if (!this.bridge) {
      this.bridge = await loadBridge();
    }
    return this.bridge;
  }

  async getLaunchRuns(jobName?: string): Promise<RunInfo[]> {
    const bridge = await this.getBridge();
    const runsResult = await bridge.launchRuns();

    if (!runsResult.ok || !runsResult.data) {
      return [];
    }

    const runs = (runsResult.data.runs ?? []) as Array<{
      launchId?: string;
      launchConfigName?: string;
      configName?: string;
      name?: string;
      status?: string;
      startedAt?: number;
      startTime?: number;
      endTime?: number;
      durationMs?: number;
      exitCode?: number;
      errors?: string[];
    }>;

    let filtered = runs;
    if (jobName) {
      filtered = runs.filter((r) => {
        const launchName = r.launchConfigName ?? r.configName ?? r.name ?? "";
        return (
          launchName === jobName ||
          launchName.startsWith(jobName + " ") ||
          launchName.includes(jobName)
        );
      });
    }

    return filtered.map((r) => {
      const startTime = r.startedAt ?? r.startTime ?? 0;
      const endTime = r.endTime ?? 0;
      return {
        id: r.launchId ?? "",
        jobName: r.launchConfigName ?? r.configName ?? r.name ?? "",
        status: r.status ?? "unknown",
        startTime,
        endTime,
        duration: endTime > 0 && startTime > 0 ? endTime - startTime : r.durationMs ?? 0,
        exitCode: r.exitCode,
        errors: r.errors,
      };
    });
  }

  async getRunDetails(runId: string): Promise<RunDetails | null> {
    const bridge = await this.getBridge();
    const statusResult = await bridge.launchRunStatus(runId);

    if (!statusResult.ok || !statusResult.data) {
      return null;
    }

    const data = statusResult.data as Record<string, unknown>;
    const startTime = (data.startedAt as number) ?? (data.startTime as number) ?? 0;
    const endTime = (data.endTime as number) ?? 0;

    return {
      id: runId,
      jobName: (data.launchConfigName as string) ?? (data.configName as string) ?? (data.name as string) ?? "",
      status: (data.status as string) ?? "unknown",
      startTime,
      endTime,
      duration: endTime > 0 && startTime > 0 ? endTime - startTime : (data.durationMs as number) ?? 0,
      exitCode: data.exitCode as number | undefined,
      errors: (data.errors as string[]) ?? [],
      logs: [],
      outputs: [],
      metrics: data.metrics as Record<string, number> | undefined,
    };
  }

  async getRunLogs(runId: string): Promise<string[]> {
    const bridge = await this.getBridge();
    const statusResult = await bridge.launchRunStatus(runId);

    if (!statusResult.ok || !statusResult.data) {
      return [];
    }

    const data = statusResult.data as Record<string, unknown>;
    const logs = data.logs ?? data.logMessages ?? data.output ?? [];
    return Array.isArray(logs) ? (logs as string[]).map(String) : [String(logs)];
  }

  async getGeneratedOutputs(runId: string): Promise<string[]> {
    const bridge = await this.getBridge();
    const statusResult = await bridge.launchRunStatus(runId);

    if (!statusResult.ok || !statusResult.data) {
      return [];
    }

    const data = statusResult.data as Record<string, unknown>;
    const outputs = data.outputs ?? data.generatedFiles ?? data.artifacts ?? [];
    return Array.isArray(outputs) ? (outputs as string[]).map(String) : [String(outputs)];
  }

  generateSummary(run: RunDetails): string {
    const statusEmoji = run.status === "OK" || run.status === "SUCCESS" ? "OK" : "ERROR";
    const durationStr = run.duration > 0 ? `${(run.duration / 1000).toFixed(1)}s` : "N/A";
    const errorCount = run.errors?.length ?? 0;

    return `[${statusEmoji}] Run ${run.id} - ${run.jobName} - Duration: ${durationStr} - Errors: ${errorCount}`;
  }

  async createEvidencePackage(runId: string): Promise<EvidencePackage | null> {
    const details = await this.getRunDetails(runId);
    if (!details) {
      return null;
    }

    const logs = await this.getRunLogs(runId);
    const outputs = await this.getGeneratedOutputs(runId);

    return {
      runId,
      summary: this.generateSummary(details),
      logs,
      outputs,
      generatedAt: Date.now(),
      duration: details.duration,
      status: details.status,
    };
  }
}

export const executionTracker = new ExecutionTrackerService();
export default executionTracker;