import { startTalendWatcher } from "../../../talend/live/watcher";
import { ok, fail } from "../common/response";
import { wrapHandler } from "../common/logger";

export function createLiveStartTool() {
  return {
    name: "talend_live_start",
    description: "Inicia el watcher reactivo para detectar cambios en el workspace.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: { type: "string", description: "Ruta del proyecto (opcional)" },
        workspacePath: { type: "string", description: "Ruta del workspace (opcional)" },
      },
    },
    handler: wrapHandler(async (input: { projectPath?: string; workspacePath?: string }) => {
      const start = Date.now();
      try {
        const result = await startTalendWatcher({ projectPath: input.projectPath, workspacePath: input.workspacePath });
        if (!result.ok) {
          return fail("LIVE_START_ERROR", result.error ?? "Error iniciando watcher", { startTime: start });
        }
        return ok(result.data, { startTime: start });
      } catch (err) {
        return fail("LIVE_START_ERROR", `Error iniciando watcher: ${err instanceof Error ? err.message : String(err)}`, { startTime: start });
      }
    }),
  };
}