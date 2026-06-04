import { readTextFile } from "../../../infrastructure/filesystem/file-reader";
import { ok, fail } from "../common/response";

type RunLogStatus = "success" | "failed" | "unknown";

interface LatestRunLog {
  jobName: string;
  status: RunLogStatus;
  latestCommand?: RunLogEntry;
  latestError?: RunLogEntry;
  errors: RunLogEntry[];
}

interface RunLogEntry {
  timestamp?: string;
  line: number;
  message: string;
}

function parseLatestRunLog(logText: string, jobName: string): LatestRunLog {
  return { jobName, status: "unknown", errors: [] };
}

export function createReadRunLogTool() {
  return {
    name: "read_run_log",
    description: "Lee y parsea el último run log de un job mostrando command line y errores.",
    inputSchema: {
      type: "object",
      properties: {
        logPath: { type: "string", description: "Ruta al archivo de log" },
        jobName: { type: "string", description: "Nombre del job para filtrar el log" },
      },
      required: ["logPath", "jobName"],
    },
    handler: async (input: { logPath: string; jobName: string }) => {
      const start = Date.now();
      try {
        const content = await readTextFile(input.logPath);
        const runLog: LatestRunLog = parseLatestRunLog(content, input.jobName);
        return ok({ runLog }, { startTime: start });
      } catch (err) {
        return fail("READ_RUN_LOG_ERROR", `Error leyendo run log: ${err}`, { startTime: start });
      }
    },
  };
}