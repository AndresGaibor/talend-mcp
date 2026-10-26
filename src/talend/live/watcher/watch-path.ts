import { watch } from "node:fs/promises";
import { getLiveTalendState, updateLiveTalendState } from "../state";
import { refreshStateFromMetadata } from "./metadata-refresh";

/**
 * Observa una ruta y vuelca cada cambio en el estado vivo.
 *
 * Al abortar el `AbortController` se detiene la iteracion; un aborto no se
 * reporta como advertencia.
 */
export async function startWatchingPath(
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
