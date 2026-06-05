import { readRun, tailRunOutput } from "../../../talend/runner/run-history";
import { ok, fail } from "../common/response";
import { wrapHandler } from "../common/logger";

export function createReadRunTool() {
  return {
    name: "talend_read_run",
    description: "Lee el detalle de una ejecución guardada por su runId.",
    inputSchema: {
      type: "object",
      properties: {
        runId: { type: "string", description: "ID de la ejecución (runId)" },
      },
      required: ["runId"],
    },
    handler: wrapHandler(async (input: { runId: string }) => {
      const start = Date.now();
      try {
        const run = await readRun(input.runId);
        if (!run) {
          return fail("RUN_NOT_FOUND", `Ejecución no encontrada: ${input.runId}`, { startTime: start });
        }
        return ok(run, { startTime: start });
      } catch (err) {
        return fail("READ_RUN_ERROR", `Error leyendo ejecución: ${err instanceof Error ? err.message : String(err)}`, { startTime: start });
      }
    }),
  };
}

export function createTailRunOutputTool() {
  return {
    name: "talend_tail_run_output",
    description: "Lee las últimas líneas de stdout/stderr de una ejecución.",
    inputSchema: {
      type: "object",
      properties: {
        runId: { type: "string", description: "ID de la ejecución" },
        stream: { type: "string", enum: ["stdout", "stderr", "both"], default: "both" },
        maxLines: { type: "number", default: 50 },
      },
      required: ["runId"],
    },
    handler: wrapHandler(async (input: { runId: string; stream?: "stdout" | "stderr" | "both"; maxLines?: number }) => {
      const start = Date.now();
      try {
        const result = await tailRunOutput({
          runId: input.runId,
          stream: input.stream ?? "both",
          maxLines: input.maxLines ?? 50,
        });
        if (result.error) {
          return fail("TAIL_RUN_OUTPUT_ERROR", result.error, { startTime: start });
        }
        return ok(result, { startTime: start });
      } catch (err) {
        return fail("TAIL_RUN_OUTPUT_ERROR", `Error leyendo output: ${err instanceof Error ? err.message : String(err)}`, { startTime: start });
      }
    }),
  };
}
