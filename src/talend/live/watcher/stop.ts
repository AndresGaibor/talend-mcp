import type { Evidence } from "../../diagnostics/types";
import { clearActiveWatcher, getActiveWatcher } from "./session";

/** Detiene el watcher activo abortando sus observadores. */
export async function stopTalendWatcher(): Promise<Evidence<{ stopped: boolean }>> {
  const active = getActiveWatcher();
  if (!active) {
    return {
      ok: false,
      source: "unknown",
      confidence: "none",
      error: "No hay un watcher activo.",
    };
  }

  active.abortController.abort();
  clearActiveWatcher();

  return {
    ok: true,
    source: "filesystem",
    confidence: "high",
    data: { stopped: true },
  };
}
