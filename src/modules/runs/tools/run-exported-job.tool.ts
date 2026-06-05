import { runExportedJob } from "../../../talend/runner/exported-job-runner";
import { ok, fail } from "../../../presentation/tools/common/response";
import { wrapHandler } from "../../../presentation/tools/common/logger";

export function createRunExportedJobTool() {
  return {
    name: "talend_run_exported_job",
    description: "Ejecuta un job exportado (compilado) desde el directorio de builds.",
    inputSchema: {
      type: "object",
      properties: {
        jobName: { type: "string", description: "Nombre del job exportado" },
        scriptPath: { type: "string", description: "Ruta explícita al script (opcional)" },
        contextName: { type: "string", description: "Nombre del contexto (default: Default)" },
        timeoutMs: { type: "number", description: "Timeout en ms (default: 300000)" },
        params: {
          type: "object",
          description: "Parámetros como TALEND_PARAM_<key>",
          additionalProperties: { type: "string" },
        },
      },
      required: ["jobName"],
    },
    handler: wrapHandler(async (input: {
      jobName: string;
      scriptPath?: string;
      contextName?: string;
      timeoutMs?: number;
      params?: Record<string, string>;
    }) => {
      const start = Date.now();
      try {
        const result = await runExportedJob({
          jobName: input.jobName,
          scriptPath: input.scriptPath,
          contextName: input.contextName,
          timeoutMs: input.timeoutMs,
          params: input.params,
        });
        return ok(result, { startTime: start });
      } catch (err) {
        return fail("RUN_EXPORTED_JOB_ERROR", `Error ejecutando job exportado: ${err instanceof Error ? err.message : String(err)}`, { startTime: start });
      }
    }),
  };
}