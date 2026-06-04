import { basename, dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import type { TalendWorkspace } from "./types";
import { parseLaunchConfig } from "./open-job";
import { createPlatformContext } from "../platform";
import { toMcpPath } from "../platform/path-bridge";

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

export function extractWorkspacePathFromLsofOutput(output: string): string | undefined {
  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/(\/[^\s]+\/studio\/workspace\/[^\/\s]+)/);
    if (match?.[1]) return match[1];
  }
  return undefined;
}

export function extractProjectPathFromLsofOutput(output: string): string | undefined {
  const paths = output
    .split(/\r?\n/)
    .map((line) => line.match(/(\/[^\s]+)$/)?.[1])
    .filter((ruta): ruta is string => Boolean(ruta));

  for (const path of paths) {
    let current = dirname(path);

    while (true) {
      if (existsSync(join(current, "talend.project"))) return current;

      try {
        const children = readdirSync(current, { withFileTypes: true });
        for (const child of children) {
          if (!child.isDirectory()) continue;
          const childPath = join(current, child.name);
          if (existsSync(join(childPath, "talend.project"))) return childPath;
        }
      } catch {
      }

      const parent = dirname(current);
      if (parent === current) break;
      current = parent;
    }
  }

  return undefined;
}

function runProcess(command: string, args: string[]): string {
  const result = spawnSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  return typeof result.stdout === "string" ? result.stdout : typeof result.stderr === "string" ? result.stderr : "";
}

function detectProjectFromRunningStudio(): string | undefined {
  const ctx = createPlatformContext();

  if (ctx.runtimeOs === "windows") return undefined;
  if (ctx.runtimeOs === "wsl") return undefined;

  if (ctx.runtimeOs === "linux") {
    const psOutput = runProcess("ps", ["-axo", "pid,command"]);
    const candidates = psOutput
      .split(/\r?\n/)
      .filter((line) => line.includes("talend") || line.includes("Talend"));

    for (const line of candidates) {
      const pid = line.trim().split(/\s+/)[0];
      if (!pid || !/^[0-9]+$/.test(pid)) continue;

      const lsofOutput = runProcess("lsof", ["-p", pid]);
      const projectPath = extractProjectPathFromLsofOutput(lsofOutput);
      if (projectPath) return projectPath;
    }
    return undefined;
  }

  const psOutput = runProcess("ps", ["-axo", "pid,command"]);
  const candidates = psOutput
    .split(/\r?\n/)
    .filter((line) => line.includes("Talend-Studio") || line.includes("TalendStudio"));

  for (const line of candidates) {
    const pid = line.trim().split(/\s+/)[0];
    if (!pid || !/^[0-9]+$/.test(pid)) continue;

    const lsofOutput = runProcess("lsof", ["-p", pid]);
    const projectPath = extractProjectPathFromLsofOutput(lsofOutput);
    if (projectPath) return projectPath;
  }

  return undefined;
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
  const ctx = createPlatformContext();
  const mcpWorkspacePath = toMcpPath(workspacePath, ctx);
  const metadataPath = join(mcpWorkspacePath, ".metadata");
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
  collectProjectCandidates(mcpWorkspacePath, projectCandidates);

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

  if (env.TALEND_PROJECT) {
    const ctx = createPlatformContext();
    return toMcpPath(env.TALEND_PROJECT, ctx);
  }

  const workspacePath = env.TALEND_WORKSPACE;
  if (workspacePath) {
    const detectedFromWorkspace = discoverProjectPathFromWorkspace(toMcpPath(workspacePath, createPlatformContext()));
    if (detectedFromWorkspace) return detectedFromWorkspace;
  }

  if (env.TALEND_DISABLE_AUTODETECT === "1" || env.TALEND_DISABLE_AUTODETECT === "true") return undefined;

  const detectedProject = detectProjectFromRunningStudio();
  if (detectedProject) return detectedProject;

  return undefined;
}
