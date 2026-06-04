import { runJob } from "../../../talend/executor";
import { ok, fail } from "../common/response";
import { wrapHandler } from "../common/logger";

export function createRunJobTool() {
  return {
    name: "talend_run_job",
    description: "Ejecuta un job de Talend Studio localmente en el proyecto configurado.",
    inputSchema: {
      type: "object",
      properties: {
        jobName: { type: "string", description: "Nombre del job a ejecutar (opcional, usa el primer job si no se especifica)" },
        contextName: { type: "string", description: "Nombre del contexto (default: Default)" },
        timeoutMs: { type: "number", description: "Timeout en ms (default: 300000)" },
        params: {
          type: "object",
          description: "Parámetros como TALEND_PARAM_<key>",
          additionalProperties: { type: "string" },
        },
      },
    },
    handler: wrapHandler(async (input: {
      jobName?: string;
      contextName?: string;
      timeoutMs?: number;
      params?: Record<string, string>;
    }) => {
      const start = Date.now();
      try {
        const result = await runJob({
          jobName: input.jobName,
          contextName: input.contextName,
          timeoutMs: input.timeoutMs,
          params: input.params,
        });
        return ok(result, { startTime: start });
      } catch (err) {
        return fail("RUN_JOB_ERROR", `Error ejecutando job: ${err instanceof Error ? err.message : String(err)}`, { startTime: start });
      }
    }),
  };
}