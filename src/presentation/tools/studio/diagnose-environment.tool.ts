import { okResult, errorResult, type Confidence } from "../common/result";
import { createPlatformContext } from "../../../platform";
import { detectRuntimeOS, detectTalendHostOS, detectPathMode } from "../../../platform/runtime";
import { getTalendMcpEnv } from "../../../config/env";
import { getConfiguredProjectPath, resolveWorkspaceFromProject } from "../../../talend/workspace";
import { detectTalendStudioProcess } from "../../../talend/studio/process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { readTalendStudioBridgeConfig, readTalendStudioBridgeToken } from "../../../talend/studio/bridge-client";
import { toMcpPath, toTalendHostPath } from "../../../platform/path-bridge";

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
  paths: {
    TALEND_PROJECT: { raw?: string; mcp?: string; talendHost?: string };
    TALEND_WORKSPACE: { raw?: string; mcp?: string; talendHost?: string };
    TALEND_STUDIO_HOME: { raw?: string; mcp?: string; talendHost?: string };
    TALEND_STUDIO_PLUGINS_DIR: { raw?: string; mcp?: string; talendHost?: string };
    TALEND_BUILDS_DIR: { raw?: string; mcp?: string; talendHost?: string };
  };
  workspace: Evidence<{ path: string; exists: boolean; }>;
  project: Evidence<{ projectName: string; projectPath: string; jobCount: number; }>;
  metadata: Evidence<{ metadataPath: string; logPath: string | null; workbenchPluginPath: string | null; launchConfigPath: string | null; }>;
  studioProcess: Evidence<{ running: boolean; pid?: number; command?: string; }>;
  bridgeStatus: Evidence<{ connected: boolean; host: string; port: number; configPath?: string; tokenPath?: string; }>;
}

function resolvePathTriple(raw: string | undefined): { raw?: string; mcp?: string; talendHost?: string } {
  if (!raw) return {};
  const ctx = createPlatformContext();
  const mcp = toMcpPath(raw, ctx);
  const talendHostPath = toTalendHostPath(mcp, ctx);
  return { raw: raw !== mcp ? raw : undefined, mcp, talendHost: talendHostPath !== mcp ? talendHostPath : undefined };
}

async function diagnoseTalendEnvironment(): Promise<TalendEnvironmentReport> {
  const ctx = createPlatformContext();

  const platform = {
    runtimeOs: ctx.runtimeOs,
    talendHostOs: ctx.talendHostOs,
    pathMode: ctx.pathMode,
    isWsl: ctx.runtimeOs === "wsl",
    nodeVersion: process.version,
    cwd: process.cwd(),
  };

  const envKeys = ["TALEND_PROJECT", "TALEND_WORKSPACE", "TALEND_STUDIO_HOME", "TALEND_STUDIO_PLUGINS_DIR", "TALEND_HOST_OS", "TALEND_PATH_MODE", "TALEND_BRIDGE_HOST", "TALEND_BRIDGE_PORT", "TALEND_BUILDS_DIR", "TALEND_DISABLE_AUTODETECT", "TALEND_BRIDGE_CONFIG", "TALEND_BRIDGE_TOKEN"];
  const env: Record<string, string | undefined> = {};
  for (const key of envKeys) {
    env[key] = process.env[key];
  }

  const paths = {
    TALEND_PROJECT: resolvePathTriple(process.env.TALEND_PROJECT),
    TALEND_WORKSPACE: resolvePathTriple(process.env.TALEND_WORKSPACE),
    TALEND_STUDIO_HOME: resolvePathTriple(process.env.TALEND_STUDIO_HOME ?? process.env.TALEND_STUDIO_PATH),
    TALEND_STUDIO_PLUGINS_DIR: resolvePathTriple(process.env.TALEND_STUDIO_PLUGINS_DIR),
    TALEND_BUILDS_DIR: resolvePathTriple(process.env.TALEND_BUILDS_DIR),
  };

  const projectPath = getConfiguredProjectPath();
  let workspace: Evidence<{ path: string; exists: boolean }>;
  if (projectPath) {
    const talendWorkspace = resolveWorkspaceFromProject(projectPath);
    const wsExists = existsSync(talendWorkspace.workspacePath);
    workspace = {
      ok: wsExists,
      source: "filesystem",
      confidence: wsExists ? "high" : "low",
      data: { path: talendWorkspace.workspacePath, exists: wsExists },
      checkedPaths: [talendWorkspace.workspacePath],
    };
  } else {
    workspace = { ok: false, source: "unknown", confidence: "none" };
  }

  let project: Evidence<{ projectName: string; projectPath: string; jobCount: number }>;
  if (projectPath) {
    const processDir = join(projectPath, "process");
    const projectExists = existsSync(projectPath);
    const processExists = existsSync(processDir);
    let jobCount = 0;
    if (projectExists && processExists) {
      try {
        const { readdirSync } = await import("node:fs");
        jobCount = readdirSync(processDir, { recursive: true }).filter(
          (e) => typeof e === "string" && e.endsWith(".item"),
        ).length;
      } catch {}
    }
    project = {
      ok: projectExists,
      source: "filesystem",
      confidence: projectExists ? "high" : "low",
      data: {
        projectName: projectPath.split("/").pop() ?? projectPath.split("\\").pop() ?? "unknown",
        projectPath,
        jobCount,
      },
      checkedPaths: [projectPath, processDir],
    };
  } else {
    project = { ok: false, source: "unknown", confidence: "none" };
  }

  let metadata: Evidence<{ metadataPath: string; logPath: string | null; workbenchPluginPath: string | null; launchConfigPath: string | null }>;
  if (projectPath) {
    const talendWorkspace = resolveWorkspaceFromProject(projectPath);
    const metadataDir = talendWorkspace.metadataPath;
    const metadataExists = existsSync(metadataDir);
    const logPath = join(metadataDir, ".log");
    const workbenchPluginPath = join(metadataDir, ".plugins", "org.eclipse.e4.workbench");
    const launchConfigPath = join(metadataDir, ".plugins", "org.eclipse.debug.core", ".launches");
    metadata = {
      ok: metadataExists,
      source: "filesystem",
      confidence: metadataExists ? "high" : "low",
      data: {
        metadataPath: metadataDir,
        logPath: existsSync(logPath) ? logPath : null,
        workbenchPluginPath: existsSync(workbenchPluginPath) ? workbenchPluginPath : null,
        launchConfigPath: existsSync(launchConfigPath) ? launchConfigPath : null,
      },
      checkedPaths: [metadataDir, logPath],
    };
  } else {
    metadata = { ok: false, source: "unknown", confidence: "none" };
  }

  const processEvidence = await detectTalendStudioProcess();
  const firstProcess = processEvidence.processes?.[0];
  const studioProcess: Evidence<{ running: boolean; pid?: number; command?: string }> = {
    ok: processEvidence.ok,
    source: processEvidence.source,
    confidence: processEvidence.confidence,
    data: firstProcess
      ? { running: true, pid: firstProcess.pid, command: firstProcess.commandLine }
      : { running: false },
    error: processEvidence.error,
  };

  let bridgeStatus: Evidence<{ connected: boolean; host: string; port: number; configPath?: string; tokenPath?: string }>;
  try {
    const config = await readTalendStudioBridgeConfig();
    const token = await readTalendStudioBridgeToken();
    const { TalendStudioBridgeClient } = await import("../../../talend/studio/bridge-client");
    const bridge = new TalendStudioBridgeClient(config, token);
    const ping = await bridge.ping();
    bridgeStatus = {
      ok: ping.ok,
      source: "studio-bridge",
      confidence: ping.ok ? "high" : "low",
      data: {
        connected: ping.ok,
        host: config.host,
        port: config.port,
        configPath: process.env.TALEND_BRIDGE_CONFIG ?? "~/.talend-bridge/config.json",
        tokenPath: process.env.TALEND_BRIDGE_TOKEN ?? "~/.talend-bridge/token",
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
    paths,
    workspace,
    project,
    metadata,
    studioProcess,
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
      try {
        const report = await diagnoseTalendEnvironment();
        return okResult({ report }, "diagnose-environment");
      } catch (err) {
        return errorResult("diagnose-environment", "DIAGNOSE_ENVIRONMENT_ERROR", `Error ejecutando diagnóstico: ${err}`);
      }
    },
  };
}