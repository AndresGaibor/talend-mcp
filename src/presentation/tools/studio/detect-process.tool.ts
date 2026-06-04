import { ok, fail } from "../common/response";
import { detectTalendStudioProcess } from "../../../talend/studio/process";

export function createDetectProcessTool() {
  return {
    name: "talend_studio_process",
    description: "Detecta si Talend Studio está corriendo como proceso en el sistema.",
    inputSchema: {
      type: "object",
      properties: {},
    },
    handler: async () => {
      const start = Date.now();
      try {
        const evidence = await detectTalendStudioProcess();
        const result = {
          running: evidence.ok,
          processes: evidence.processes?.map((p) => ({
            pid: p.pid,
            name: p.name,
            command: p.commandLine,
            matchedBy: p.matchedBy,
          })),
          confidence: evidence.confidence,
          source: evidence.source,
        };
        return ok(result, { startTime: start });
      } catch (err) {
        return fail("DETECT_PROCESS_ERROR", `Error detectando proceso: ${err}`, { startTime: start });
      }
    },
  };
}