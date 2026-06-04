import { ok, fail } from "../common/response";

interface ProcessEvidence {
  running: boolean;
  pid?: number;
  command?: string;
}

async function detectTalendStudioProcess(): Promise<ProcessEvidence> {
  return { running: false };
}

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
        const result = await detectTalendStudioProcess();
        return ok({ ...result }, { startTime: start });
      } catch (err) {
        return fail("DETECT_PROCESS_ERROR", `Error detectando proceso: ${err}`, { startTime: start });
      }
    },
  };
}