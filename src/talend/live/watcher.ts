import { watch } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { getConfiguredProjectPath, resolveWorkspaceFromProject } from "../workspace";
import { readTextFile } from "../files";
import { parseWorkbenchState } from "../studio/workbench-xmi";
import { updateLiveTalendState, getLiveTalendState, resetLiveTalendState } from "./state";
import type { LiveTalendState } from "./state";
import type { Evidence, Confidence } from "../diagnostics/types";

const WATCH_PATTERNS = [
  "process/**/*.item",
  "process/**/*.properties",
  "context/**/*.item",
  ".metadata/.log",
  ".metadata/.plugins/org.eclipse.e4.workbench/*.xmi",
  ".metadata/.plugins/org.eclipse.debug.core/.launches/*.launch",
];

interface WatcherInstance {
  abortController: AbortController;
  projectPath: string;
}

let activeWatcher: WatcherInstance | null = null;

async function getPathsToWatch(projectPath: string): Promise<string[]> {
  const ws = resolveWorkspaceFromProject(projectPath);
  const paths: string[] = [];

  const candidates = [
    join(projectPath, "process"),
    join(projectPath, "context"),
    join(ws.metadataPath, ".plugins", "org.eclipse.e4.workbench"),
    join(ws.metadataPath, ".plugins", "org.eclipse.debug.core", ".launches"),
  ];

  for (const p of candidates) {
    if (existsSync(p)) paths.push(p);
  }

  const logPath = join(ws.metadataPath, ".log");
  if (existsSync(logPath)) {
    paths.push(ws.metadataPath);
  }

  return paths;
}

export async function startTalendWatcher(options?: {
  workspacePath?: string;
  projectPath?: string;
}): Promise<Evidence<{ watchedPaths: string[] }>> {
  if (activeWatcher) {
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
    activeWatcher = { abortController, projectPath };

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

async function startWatchingPath(
  watchPath: string,
  signal: AbortSignal,
): Promise<void> {
  try {
    const watcher = watch(watchPath, { recursive: true, signal });
    for await (const event of watcher) {
      const filename = event.filename ?? "";
      const eventType = event.eventType as "created" | "modified" | "deleted" | "unknown";

      updateLiveTalendState({
        lastFileChange: {
          path: filename,
          event: eventType,
          at: new Date().toISOString(),
        },
      });

      if (
        filename.includes(".xmi") ||
        filename.includes(".launch") ||
        filename === ".log"
      ) {
        await refreshStateFromMetadata(filename);
      }
    }
  } catch (err) {
    if ((err as Error).name !== "AbortError") {
      updateLiveTalendState({
        warnings: [
          ...getLiveTalendState().warnings,
          `Watcher error on ${watchPath}: ${err instanceof Error ? err.message : String(err)}`,
        ],
      });
    }
  }
}

async function refreshStateFromMetadata(filename: string): Promise<void> {
  if (filename.endsWith(".xmi")) {
    const projectPath = getConfiguredProjectPath();
    if (projectPath) {
      const xmiResult = await parseWorkbenchState(projectPath);
      if (xmiResult.ok && xmiResult.data?.activeEditor?.probableJobName) {
        updateLiveTalendState({
          probableOpenJob: {
            jobName: xmiResult.data.activeEditor.probableJobName,
            source: "workbench-xmi",
            confidence: "medium",
            detectedAt: new Date().toISOString(),
          },
        });
      }
    }
  }

  if (filename === ".log") {
    const projectPath = getConfiguredProjectPath();
    if (projectPath) {
      const ws = resolveWorkspaceFromProject(projectPath);
      const logPath = join(ws.metadataPath, ".log");
      try {
        const content = await readTextFile(logPath, ws.workspacePath);
        const errorLines = content
          .split("\n")
          .filter((l: string) => l.includes("ERROR") || l.includes("Exception"));
        if (errorLines.length > 0) {
          const lastError = errorLines[errorLines.length - 1] ?? "";
          updateLiveTalendState({
            lastStudioError: {
              message: lastError.substring(0, 500),
              source: "metadata-log",
              detectedAt: new Date().toISOString(),
              snippet: lastError.substring(0, 200),
            },
          });
        }
      } catch {
        // ignore log read errors
      }
    }
  }
}

export async function stopTalendWatcher(): Promise<Evidence<{ stopped: boolean }>> {
  if (!activeWatcher) {
    return {
      ok: false,
      source: "unknown",
      confidence: "none",
      error: "No hay un watcher activo.",
    };
  }

  activeWatcher.abortController.abort();
  activeWatcher = null;

  return {
    ok: true,
    source: "filesystem",
    confidence: "high",
    data: { stopped: true },
  };
}

export function getLiveWatcherStatus(): Evidence<{
  active: boolean;
  startedAt?: string;
  projectPath?: string;
  projectName?: string;
  lastChange?: LiveTalendState["lastFileChange"];
  warnings: string[];
}> {
  const state = getLiveTalendState();
  if (!activeWatcher) {
    return {
      ok: false,
      source: "unknown",
      confidence: "none",
      error: "No hay un watcher activo. Usa talend_live_start para iniciarlo.",
    };
  }

  return {
    ok: true,
    source: "filesystem",
    confidence: "high",
    data: {
      active: true,
      startedAt: state.startedAt,
      projectPath: state.projectPath,
      projectName: state.projectName,
      lastChange: state.lastFileChange,
      warnings: state.warnings,
    },
  };
}
