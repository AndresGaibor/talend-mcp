import { getLiveWatcherStatus } from "../../../talend/live/watcher";
import { ok, fail } from "../common/response";
import { wrapHandler } from "../common/logger";

export function createLiveStatusTool() {
  return {
    name: "talend_live_status",
    description: "Obtiene el estado actual del watcher de archivos.",
    inputSchema: {
      type: "object",
      properties: {},
    },
    handler: wrapHandler(async () => {
      const start = Date.now();
      try {
        const result = getLiveWatcherStatus();
        if (!result.ok) {
          return fail("LIVE_STATUS_ERROR", result.error ?? "Watcher no activo", { startTime: start });
        }
        return ok(result.data, { startTime: start });
      } catch (err) {
        return fail("LIVE_STATUS_ERROR", `Error obteniendo estado: ${err instanceof Error ? err.message : String(err)}`, { startTime: start });
      }
    }),
  };
}