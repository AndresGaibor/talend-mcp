import { listRuns } from "../../../talend/runner/run-history";
import { ok, fail } from "../../../presentation/tools/common/response";
import { wrapHandler } from "../../../presentation/tools/common/logger";

export function createListRunsTool() {
  return {
    name: "talend_list_runs",
    description: "Lista las ejecuciones de jobs guardadas en el historial local.",
    inputSchema: {
      type: "object",
      properties: {
        jobName: { type: "string", description: "Filtrar por nombre de job (opcional)" },
        limit: { type: "number", description: "Límite de resultados (default: 20)" },
      },
    },
    handler: wrapHandler(async (input: { jobName?: string; limit?: number }) => {
      const start = Date.now();
      try {
        const runs = await listRuns({ jobName: input.jobName, limit: input.limit ?? 20 });
        return ok(runs, { startTime: start });
      } catch (err) {
        return fail("LIST_RUNS_ERROR", `Error listando ejecuciones: ${err instanceof Error ? err.message : String(err)}`, { startTime: start });
      }
    }),
  };
}