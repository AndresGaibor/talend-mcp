export type Confidence = "high" | "medium" | "low" | "none";

export interface Evidence<T = unknown> {
  ok: boolean;
  source:
    | "filesystem"
    | "workbench-xmi"
    | "metadata-log"
    | "launch-config"
    | "exported-job-script"
    | "studio-bridge"
    | "process"
    | "unknown";
  confidence: Confidence;
  data?: T;
  error?: string;
  checkedPaths?: string[];
  nextSteps?: string[];
}

export interface TalendEnvironmentReport {
  workspace: Evidence<{
    path: string;
    exists: boolean;
  }>;
  project: Evidence<{
    projectName: string;
    projectPath: string;
    jobCount: number;
  }>;
  metadata: Evidence<{
    metadataPath: string;
    logPath: string | null;
    workbenchPluginPath: string | null;
    launchConfigPath: string | null;
  }>;
  studioProcess: Evidence<{
    running: boolean;
    pid?: number;
    command?: string;
  }>;
}
