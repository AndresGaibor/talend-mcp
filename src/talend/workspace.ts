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

/**
 * Extrae las rutas candidatas del output de `lsof` sin tocar el filesystem.
 * `lsof` solo existe en Unix, por eso el parser trabaja con rutas POSIX.
 */
export function extractCandidatePathsFromLsofOutput(output: string): string[] {
  return output
    .split(/\r?\n/)
    .map((line) => line.match(/(\/[^\s]+)$/)?.[1])
    .filter((ruta): ruta is string => Boolean(ruta));
}

/**
 * Busca hacia arriba la carpeta que contiene `talend.project`, revisando también
 * las subcarpetas de cada nivel.
 */
export function findProjectDirFromCandidates(paths: string[]): string | undefined {
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

export function extractProjectPathFromLsofOutput(output: string): string | undefined {
  return findProjectDirFromCandidates(extractCandidatePathsFromLsofOutput(output));
}

function runProcess(command: string, args: string[]): string {
  const result = spawnSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 10_000 });
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
  const cacheKey = resolve(mcpWorkspacePath);
  const now = Date.now();
  const cached = workspaceProjectCache.get(cacheKey);
  if (cached && cached.expiresAt > now) return cached.projectPath;

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

  if (projectCandidates.length === 0) {
    workspaceProjectCache.set(cacheKey, { projectPath: undefined, expiresAt: now + WORKSPACE_DISCOVERY_CACHE_MS });
    return undefined;
  }

  const uniqueCandidates = [...new Set(projectCandidates)].sort();
  if (projectNames.size > 0) {
    const matched = uniqueCandidates.find((projectPath) => projectNames.has(basename(projectPath)));
    if (matched) {
      workspaceProjectCache.set(cacheKey, { projectPath: matched, expiresAt: now + WORKSPACE_DISCOVERY_CACHE_MS });
      return matched;
    }
  }

  const projectPath = uniqueCandidates[0];
  workspaceProjectCache.set(cacheKey, { projectPath, expiresAt: now + WORKSPACE_DISCOVERY_CACHE_MS });
  return projectPath;
}

const WORKSPACE_DISCOVERY_CACHE_MS = 5_000;
const workspaceProjectCache = new Map<string, { projectPath: string | undefined; expiresAt: number }>();

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

  // Proyecto abierto en Talend Studio, detectado via el bridge.
  if (cachedBridgeProjectPath) return cachedBridgeProjectPath;

  if (env.TALEND_DISABLE_AUTODETECT === "1" || env.TALEND_DISABLE_AUTODETECT === "true") return undefined;

  const detectedProject = detectProjectFromRunningStudio();
  if (detectedProject) return detectedProject;

  return undefined;
}

/**
 * Convierte la ubicacion de un proyecto Eclipse a una ruta local.
 * El bridge devuelve `file:/C:/ruta/proyecto` o `file:/ruta/proyecto`.
 */
function eclipseLocationToPath(location: string): string | undefined {
  if (!location) return undefined;

  let path = location.trim();
  if (path.startsWith("file:")) {
    path = path.slice("file:".length);
    if (path.startsWith("/")) path = path.slice(1);
  }
  path = decodeURIComponent(path);

  // En Windows queda "C:/ruta"; en Unix "/ruta".
  if (/^[a-zA-Z]:[\\/]/.test(path)) return path;
  if (path.startsWith("/")) return path;

  return undefined;
}

let cachedBridgeProjectPath: string | undefined;
let bridgeProjectMissExpiresAt = 0;
let bridgeProjectDetectionInFlight: Promise<string | undefined> | undefined;

/**
 * Detecta el proyecto Talend abierto en Studio usando el bridge.
 *
 * Es la unvia que funciona en Windows y WSL, donde `lsof` no existe. El bridge
 * expone el workspace con los proyectos abiertos y su ubicacion.
 */
export async function detectProjectFromBridge(): Promise<string | undefined> {
  if (cachedBridgeProjectPath) return cachedBridgeProjectPath;
  if (bridgeProjectMissExpiresAt > Date.now()) return undefined;
  if (bridgeProjectDetectionInFlight) return bridgeProjectDetectionInFlight;

  const detection = async (): Promise<string | undefined> => {
    try {
      const { createBridgeClient } = await import("../modules/studio-bridge/adapters/http-studio-bridge.client");
      const bridge = await createBridgeClient();
      const result = await bridge.workspaceState();

      if (!result.ok || !result.data) return undefined;

      const projects = (result.data as { projects?: Array<{ name?: string; open?: boolean; location?: string }> }).projects ?? [];

      for (const project of projects) {
        if (project.open === false) continue;
        const path = project.location ? eclipseLocationToPath(project.location) : undefined;
        if (!path) continue;
        if (!existsSync(join(path, "talend.project"))) continue;

        cachedBridgeProjectPath = path;
        bridgeProjectMissExpiresAt = 0;
        return path;
      }
    } catch {
      // El bridge puede no estar instalado o Studio no estar abierto.
    }
    // Evita repetir una consulta que puede esperar hasta el timeout del bridge.
    bridgeProjectMissExpiresAt = Date.now() + 3_000;
    return undefined;
  };

  const pending = detection();
  bridgeProjectDetectionInFlight = pending;
  try {
    return await pending;
  } finally {
    if (bridgeProjectDetectionInFlight === pending) bridgeProjectDetectionInFlight = undefined;
  }
}

/**
 * Resuelve el proyecto Talend con el que trabajar.
 *
 * Prioridad: ruta explicita, variable de entorno, repositorio activo, el
 * proyecto abierto en Studio (via bridge) y por ultimo la autodeteccion del
 * sistema operativo.
 */
export async function resolveProjectPath(explicitPath?: string): Promise<string | undefined> {
  if (explicitPath && explicitPath.trim()) {
    return toMcpPath(explicitPath.trim(), createPlatformContext());
  }

  const configured = getConfiguredProjectPath();
  if (configured) return configured;

  return await detectProjectFromBridge();
}
