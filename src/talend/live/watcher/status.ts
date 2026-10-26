import type { Evidence } from "../../diagnostics/types";
import { getLiveTalendState } from "../state";
import type { LiveTalendState } from "../state";
import { getActiveWatcher } from "./session";

/** Estado del watcher: rutas observadas, ultimo cambio y advertencias. */
export function getLiveWatcherStatus(): Evidence<{
  active: boolean;
  startedAt?: string;
  projectPath?: string;
  projectName?: string;
  lastChange?: LiveTalendState["lastFileChange"];
  warnings: string[];
}> {
  const state = getLiveTalendState();
  if (!getActiveWatcher()) {
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
