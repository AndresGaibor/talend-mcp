import { getLiveTalendState } from "../../../talend/live/state";
import { ok, fail } from "../common/response";
import { wrapHandler } from "../common/logger";

export function createLatestChangesTool() {
  return {
    name: "talend_latest_changes",
    description: "Obtiene los últimos cambios detectados por el watcher (archivo modificado, job abierto, error de Studio).",
    inputSchema: {
      type: "object",
      properties: {},
    },
    handler: wrapHandler(async () => {
      const start = Date.now();
      try {
        const state = getLiveTalendState();
        return ok(state, { startTime: start });
      } catch (err) {
        return fail("LATEST_CHANGES_ERROR", `Error obteniendo estado: ${err instanceof Error ? err.message : String(err)}`, { startTime: start });
      }
    }),
  };
}