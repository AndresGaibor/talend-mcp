import { basename, dirname, join, resolve } from "node:path";
import type { TalendWorkspace } from "./types";

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

export function getConfiguredProjectPath(
  env: Record<string, string | undefined> = process.env,
): string | undefined {
  return activeRepoPath ?? env.TALEND_PROJECT;
}