import { readTextFile } from "../../../infrastructure/filesystem/file-reader";
import { ok, fail } from "../common/response";

interface LogContentResult {
  lines: string[];
  totalLines: number;
  truncated: boolean;
}

function readLogContent(logPath: string, options?: { maxLines?: number; filter?: string; fromLine?: number; }): LogContentResult {
  return { lines: [], totalLines: 0, truncated: false };
}

function formatLogLines(lines: string[], showLineNumbers?: boolean): string {
  return lines.join("\n");
}

export function createViewLogsTool() {
  return {
    name: "view_logs",
    description: "Muestra el contenido de un archivo de log con opción de filtrar y limitar líneas.",
    inputSchema: {
      type: "object",
      properties: {
        logPath: { type: "string", description: "Ruta al archivo de log" },
        maxLines: { type: "number", description: "Número máximo de líneas a mostrar", default: 100 },
        filter: { type: "string", description: "Filtrar líneas que contengan este texto" },
        fromLine: { type: "number", description: "Empezar desde esta línea" },
      },
      required: ["logPath"],
    },
    handler: async (input: { logPath: string; maxLines?: number; filter?: string; fromLine?: number }) => {
      const start = Date.now();
      try {
        const result = readLogContent(input.logPath, {
          maxLines: input.maxLines,
          filter: input.filter,
          fromLine: input.fromLine,
        });
        const formatted = formatLogLines(result.lines, true);
        return ok({
          lines: result.lines,
          formatted,
          totalLines: result.totalLines,
          truncated: result.truncated,
        }, { startTime: start });
      } catch (err) {
        return fail("VIEW_LOGS_ERROR", `Error leyendo logs: ${err}`, { startTime: start });
      }
    },
  };
}