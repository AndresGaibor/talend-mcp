import { existsSync } from "node:fs";
import { join } from "node:path";
import { getConfiguredProjectPath, resolveWorkspaceFromProject } from "../workspace";
import { listJobs } from "../repository";
import { detectTalendStudioProcess } from "../studio/process";
import type { Evidence, TalendEnvironmentReport, Confidence } from "./types";

export async function diagnoseTalendEnvironment(): Promise<TalendEnvironmentReport> {
  const projectPath = getConfiguredProjectPath();

  const workspace = await diagnoseWorkspace(projectPath);
  const project = await diagnoseProject(projectPath);
  const metadata = await diagnoseMetadata(projectPath);
  const studioProcess = await diagnoseStudioProcess();

  const overallOk = workspace.ok || project.ok;

  return {
    workspace,
    project,
    metadata,
    studioProcess,
  };
}

async function diagnoseWorkspace(projectPath: string | undefined): Promise<Evidence<{ path: string; exists: boolean }>> {
  if (!projectPath) {
    return {
      ok: false,
      source: "unknown",
      confidence: "none",
      error: "No se pudo detectar workspace. Configura TALEND_PROJECT o usa talend_repo_setup.",
    };
  }
  const ws = resolveWorkspaceFromProject(projectPath);
  const exists = existsSync(ws.workspacePath);
  return {
    ok: exists,
    source: "filesystem",
    confidence: exists ? "high" : "none",
    data: { path: ws.workspacePath, exists },
    checkedPaths: [ws.workspacePath],
  };
}

async function diagnoseProject(
  projectPath: string | undefined,
): Promise<Evidence<{ projectName: string; projectPath: string; jobCount: number }>> {
  if (!projectPath || !existsSync(projectPath)) {
    return {
      ok: false,
      source: "unknown",
      confidence: "none",
      error: "No se pudo detectar proyecto Talend. Configura TALEND_PROJECT o usa talend_repo_setup.",
    };
  }
  try {
    const ws = resolveWorkspaceFromProject(projectPath);
    const jobs = await listJobs(projectPath);
    return {
      ok: true,
      source: "filesystem",
      confidence: "high",
      data: {
        projectName: ws.projectName,
        projectPath,
        jobCount: jobs.length,
      },
      checkedPaths: [join(projectPath, "process")],
    };
  } catch (err) {
    return {
      ok: false,
      source: "unknown",
      confidence: "none",
      error: `Error leyendo proyecto: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

async function diagnoseMetadata(
  projectPath: string | undefined,
): Promise<
  Evidence<{
    metadataPath: string;
    logPath: string | null;
    workbenchPluginPath: string | null;
    launchConfigPath: string | null;
  }>
> {
  if (!projectPath) {
    return {
      ok: false,
      source: "unknown",
      confidence: "none",
      error: "No hay projectPath para diagnosticar metadata.",
    };
  }
  const ws = resolveWorkspaceFromProject(projectPath);
  const metadataPath = ws.metadataPath;
  const metadataExists = existsSync(metadataPath);

  if (!metadataExists) {
    return {
      ok: false,
      source: "filesystem",
      confidence: "none",
      data: {
        metadataPath,
        logPath: null,
        workbenchPluginPath: null,
        launchConfigPath: null,
      },
      error: "No existe .metadata en el workspace.",
      checkedPaths: [metadataPath],
    };
  }

  const logPath = join(metadataPath, ".log");
  const logExists = existsSync(logPath);

  const workbenchPluginPath = join(metadataPath, ".plugins", "org.eclipse.e4.workbench");
  const workbenchExists = existsSync(workbenchPluginPath);

  const launchConfigPath = join(metadataPath, ".plugins", "org.eclipse.debug.core", ".launches");
  const launchExists = existsSync(launchConfigPath);

  return {
    ok: true,
    source: "filesystem",
    confidence: "high",
    data: {
      metadataPath,
      logPath: logExists ? logPath : null,
      workbenchPluginPath: workbenchExists ? workbenchPluginPath : null,
      launchConfigPath: launchExists ? launchConfigPath : null,
    },
    checkedPaths: [metadataPath, logPath, workbenchPluginPath, launchConfigPath],
  };
}

async function diagnoseStudioProcess(): Promise<Evidence<{ running: boolean; pid?: number; command?: string }>> {
  try {
    const processResult = await detectTalendStudioProcess();
    if (processResult.ok && processResult.processes && processResult.processes.length > 0) {
      const first = processResult.processes[0]!;
      return {
        ok: true,
        source: "process",
        confidence: processResult.confidence as Confidence,
        data: {
          running: true,
          pid: first.pid,
          command: `${first.name} ${first.commandLine ?? ""}`.trim(),
        },
      };
    }
    return {
      ok: true,
      source: "process",
      confidence: "none",
      data: { running: false },
    };
  } catch (err) {
    return {
      ok: false,
      source: "unknown",
      confidence: "none",
      error: `Error detectando proceso: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
