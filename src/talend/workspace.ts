import { basename, dirname, join, resolve } from "node:path";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import type { TalendWorkspace } from "./types";
import { parseLaunchConfig } from "./open-job";

// ── Estado mutable para modo repositorio ──

let activeRepoPath: string | undefined;
let activeProjectName: string | undefined;

export function setActiveRepo(path: string, projectName?: string): void {
  activeRepoPath = path;
  activeProjectName = projectName;
}

export function clearActiveRepo(): void {
  activeRepoPath = undefined;
  activeProjectName = undefined;
}

export function getActiveRepoPath(): string | undefined {
  return activeRepoPath;
}

export function isRepoMode(): boolean {
  return activeRepoPath !== undefined;
}

// ── Funciones de workspace ──

export function resolveWorkspaceFromProject(rawPath: string): TalendWorkspace {
  const projectPath = resolve(rawPath);
  const projectName = basename(projectPath);
  const workspacePath = dirname(dirname(projectPath));
  return {
    workspacePath,
    projectPath: projectPath,
    projectName,
    metadataPath: join(workspacePath, ".metadata"),
  };
}

function collectProjectCandidates(rutaDirectorio: string, candidatos: string[]): void {
  if (!existsSync(rutaDirectorio)) return;

  for (const entrada of readdirSync(rutaDirectorio, { withFileTypes: true })) {
    const rutaEntrada = join(rutaDirectorio, entrada.name);
    if (entrada.isDirectory()) {
      if (entrada.name === "process") {
        candidatos.push(dirname(rutaEntrada));
        continue;
      }

      if (entrada.name === ".metadata") continue;
      collectProjectCandidates(rutaEntrada, candidatos);
    }
  }
}

export function discoverProjectPathFromWorkspace(workspacePath: string): string | undefined {
  const metadataPath = join(workspacePath, ".metadata");
  const launchesDir = join(metadataPath, ".plugins", "org.eclipse.debug.core", ".launches");
  const projectNames = new Set<string>();

  if (existsSync(launchesDir)) {
    for (const entry of readdirSync(launchesDir, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith(".launch")) continue;

      try {
        const launchPath = join(launchesDir, entry.name);
        const launchXml = readFileSync(launchPath, "utf-8");
        const launch = parseLaunchConfig(launchXml, launchPath);
        if (launch.currentProjectName) projectNames.add(launch.currentProjectName);
        if (launch.jobProjectTechLabel) projectNames.add(launch.jobProjectTechLabel);
      } catch {
        continue;
      }
    }
  }

  const projectCandidates: string[] = [];
  collectProjectCandidates(workspacePath, projectCandidates);

  if (projectCandidates.length === 0) return undefined;

  const uniqueCandidates = [...new Set(projectCandidates)].sort();
  if (projectNames.size > 0) {
    const matched = uniqueCandidates.find((projectPath) => projectNames.has(basename(projectPath)));
    if (matched) return matched;
  }

  return uniqueCandidates[0];
}

export function getConfiguredProjectPath(
  env: Record<string, string | undefined> = process.env,
): string | undefined {
  if (activeRepoPath) return activeRepoPath;
  if (env.TALEND_PROJECT) return env.TALEND_PROJECT;

  const workspacePath = env.TALEND_WORKSPACE;
  if (!workspacePath) return undefined;

  return discoverProjectPathFromWorkspace(workspacePath);
}
