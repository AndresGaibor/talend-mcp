import { ok, fail } from "../common/response";

type Confidence = "high" | "medium" | "low" | "none";

interface Evidence<T = unknown> {
  ok: boolean;
  source: "unknown" | "filesystem" | "workbench-xmi" | "metadata-log" | "launch-config" | "exported-job-script" | "studio-bridge" | "process";
  confidence: Confidence;
  data?: T | undefined;
  error?: string | undefined;
  checkedPaths?: string[] | undefined;
  nextSteps?: string[] | undefined;
}

interface TalendEnvironmentReport {
  workspace: Evidence<{ path: string; exists: boolean; }>;
  project: Evidence<{ projectName: string; projectPath: string; jobCount: number; }>;
  metadata: Evidence<{ metadataPath: string; logPath: string | null; workbenchPluginPath: string | null; launchConfigPath: string | null; }>;
  studioProcess: Evidence<{ running: boolean; pid?: number; command?: string; }>;
}

async function diagnoseTalendEnvironment(): Promise<TalendEnvironmentReport> {
  return {
    workspace: { ok: false, source: "unknown", confidence: "none" },
    project: { ok: false, source: "unknown", confidence: "none" },
    metadata: { ok: false, source: "unknown", confidence: "none" },
    studioProcess: { ok: false, source: "unknown", confidence: "none" },
  };
}

export function createDiagnoseEnvironmentTool() {
  return {
    name: "talend_diagnose_environment",
    description: "Diagnostica el entorno de Talend: workspace, proyecto, metadata y proceso del Studio.",
    inputSchema: {
      type: "object",
      properties: {},
    },
    handler: async () => {
      const start = Date.now();
      try {
        const report = await diagnoseTalendEnvironment();
        return ok({ report }, { startTime: start });
      } catch (err) {
        return fail("DIAGNOSE_ENVIRONMENT_ERROR", `Error ejecutando diagnóstico: ${err}`, { startTime: start });
      }
    },
  };
}