import { existsSync } from "node:fs";
import { getConfiguredProjectPath, resolveWorkspaceFromProject } from "../../workspace";
import { updateLiveTalendState, resetLiveTalendState } from "../state";
import type { Evidence } from "../../diagnostics/types";
import { getActiveWatcher, setActiveWatcher } from "./session";
import { getPathsToWatch } from "./watch-paths";
import { startWatchingPath } from "./watch-path";

/**
 * Arranca el watcher del proyecto Talend.
 *
 * Falla si ya hay uno activo, si el `projectPath` no esta confirmado, si la
 * ruta no existe o si no hay nada que observar.
 */
export async function startTalendWatcher(options?: {
  workspacePath?: string;
  projectPath?: string;
}): Promise<Evidence<{ watchedPaths: string[] }>> {
  if (getActiveWatcher()) {
    return {
      ok: false,
      source: "filesystem",
      confidence: "none",
      error: "Ya hay un watcher activo. Usa talend_live_stop primero.",
    };
  }

  const projectPath = options?.projectPath ?? getConfiguredProjectPath();
  if (!projectPath) {
    return {
      ok: false,
      source: "unknown",
      confidence: "none",
      error: "No se puede iniciar watcher porque projectPath no está confirmado. Configura TALEND_PROJECT o usa talend_repo_setup.",
    };
  }

  if (!existsSync(projectPath)) {
    return {
      ok: false,
      source: "filesystem",
      confidence: "none",
      error: `El projectPath no existe: ${projectPath}`,
    };
  }

  try {
    const pathsToWatch = await getPathsToWatch(projectPath);
    if (pathsToWatch.length === 0) {
      return {
        ok: false,
        source: "filesystem",
        confidence: "none",
        error: "No se encontraron rutas para observar en el proyecto.",
        checkedPaths: pathsToWatch,
      };
    }

    const abortController = new AbortController();
    setActiveWatcher({ abortController, projectPath });

    resetLiveTalendState();
    updateLiveTalendState({
      workspacePath: options?.workspacePath ?? resolveWorkspaceFromProject(projectPath).workspacePath,
      projectPath,
      projectName: resolveWorkspaceFromProject(projectPath).projectName,
    });

    for (const watchPath of pathsToWatch) {
      startWatchingPath(watchPath, abortController.signal).catch(() => {});
    }

    return {
      ok: true,
      source: "filesystem",
      confidence: "high",
      data: { watchedPaths: pathsToWatch },
    };
  } catch (err) {
    return {
      ok: false,
      source: "unknown",
      confidence: "none",
      error: `Error iniciando watcher: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
