import { stopTalendWatcher } from "../../../talend/live/watcher";
import { ok, fail } from "../common/response";
import { wrapHandler } from "../common/logger";

export function createLiveStopTool() {
  return {
    name: "talend_live_stop",
    description: "Detiene el watcher de archivos activo.",
    inputSchema: {
      type: "object",
      properties: {},
    },
    handler: wrapHandler(async () => {
      const start = Date.now();
      try {
        const result = await stopTalendWatcher();
        if (!result.ok) {
          return fail("LIVE_STOP_ERROR", result.error ?? "Error deteniendo watcher", { startTime: start });
        }
        return ok(result.data, { startTime: start });
      } catch (err) {
        return fail("LIVE_STOP_ERROR", `Error deteniendo watcher: ${err instanceof Error ? err.message : String(err)}`, { startTime: start });
      }
    }),
  };
}