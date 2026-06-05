import { readRun } from "../../../talend/runner/run-history";
import { ok, fail } from "../../../presentation/tools/common/response";
import { wrapHandler } from "../../../presentation/tools/common/logger";

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