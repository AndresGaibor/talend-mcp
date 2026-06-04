import { ok, fail } from "../common/response";
import { createPlatformContext } from "../../../platform";
import { detectRuntimeOS, detectTalendHostOS, detectPathMode } from "../../../platform/runtime";
import { getTalendMcpEnv } from "../../../config/env";

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
  platform: {
    runtimeOs: string;
    talendHostOs: string;
    pathMode: string;
    isWsl: boolean;
    nodeVersion: string;
    cwd: string;
  };
  env: Record<string, string | undefined>;
  workspace: Evidence<{ path: string; exists: boolean; }>;
  project: Evidence<{ projectName: string; projectPath: string; jobCount: number; }>;
  metadata: Evidence<{ metadataPath: string; logPath: string | null; workbenchPluginPath: string | null; launchConfigPath: string | null; }>;
  studioProcess: Evidence<{ running: boolean; pid?: number; command?: string; }>;
  bridgeStatus: Evidence<{ connected: boolean; host: string; port: number; }>;
}

async function diagnoseTalendEnvironment(): Promise<TalendEnvironmentReport> {
  const ctx = createPlatformContext();
  const talendMcpEnv = getTalendMcpEnv();

  const platform = {
    runtimeOs: ctx.runtimeOs,
    talendHostOs: ctx.talendHostOs,
    pathMode: ctx.pathMode,
    isWsl: ctx.runtimeOs === "wsl",
    nodeVersion: process.version,
    cwd: process.cwd(),
  };

  const env: Record<string, string | undefined> = {};
  const envKeys = ["TALEND_PROJECT", "TALEND_WORKSPACE", "TALEND_STUDIO_HOME", "TALEND_STUDIO_PLUGINS_DIR", "TALEND_HOST_OS", "TALEND_PATH_MODE", "TALEND_BRIDGE_HOST", "TALEND_BRIDGE_PORT", "TALEND_BUILDS_DIR", "TALEND_DISABLE_AUTODETECT"];
  for (const key of envKeys) {
    env[key] = process.env[key];
  }

  let bridgeStatus: Evidence<{ connected: boolean; host: string; port: number }>;
  try {
    const { TalendStudioBridgeClient } = await import("../../../talend/studio/bridge-client");
    const bridge = await TalendStudioBridgeClient.create();
    const ping = await bridge.ping();
    bridgeStatus = {
      ok: ping.ok,
      source: "studio-bridge",
      confidence: ping.ok ? "high" : "low",
      data: {
        connected: ping.ok,
        host: bridge.getConfig().host,
        port: bridge.getConfig().port,
      },
    };
  } catch {
    bridgeStatus = {
      ok: false,
      source: "studio-bridge",
      confidence: "none",
      data: { connected: false, host: "127.0.0.1", port: 3930 },
      error: "No se pudo conectar al bridge",
    };
  }

  return {
    platform,
    env,
    workspace: { ok: false, source: "unknown", confidence: "none" },
    project: { ok: false, source: "unknown", confidence: "none" },
    metadata: { ok: false, source: "unknown", confidence: "none" },
    studioProcess: { ok: false, source: "unknown", confidence: "none" },
    bridgeStatus,
  };
}

export function createDiagnoseEnvironmentTool() {
  return {
    name: "talend_diagnose_environment",
    description: "Diagnostica el entorno de Talend: plataforma, workspace, proyecto, metadata y proceso del Studio.",
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
