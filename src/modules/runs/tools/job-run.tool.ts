import { z } from "zod/v4";
import { okResult, errorResult } from "../../../presentation/tools/common/result";
import { runJob } from "../../../talend/executor";
import { readRun } from "../../../talend/runner/run-history";

const RunSchema = z.object({
  job: z.string().describe("Nombre del job"),
  context: z.string().optional().describe("Contexto (default: Default)"),
  timeoutMs: z.number().optional().describe("Timeout en ms"),
  params: z.record(z.string(), z.string()).optional(),
  confirm: z.boolean().optional().describe("Confirmar ejecución con efectos externos"),
});

export function createJobRunTool() {
  return {
    name: "talend_job_run",
    description: "Ejecuta un job de forma explícita. Requiere confirm=true por los efectos externos.",
    inputSchema: RunSchema,
    handler: async (input: z.infer<typeof RunSchema>) => {
      if (input.confirm !== true) {
        return errorResult("job-run", "CONFIRMATION_REQUIRED", "La ejecución requiere confirm: true.");
      }
      try {
        const result = await runJob({ jobName: input.job, contextName: input.context, timeoutMs: input.timeoutMs, params: input.params });
        return okResult(result, "job-run");
      } catch (err) {
        return errorResult("job-run", "RUN_ERROR", `Error ejecutando job: ${err}`);
      }
    },
  };
}

const StatusSchema = z.object({ runId: z.string() });

export function createRunStatusTool() {
  return {
    name: "talend_run_status",
    description: "Consulta el estado y el resultado de una ejecución por su runId.",
    inputSchema: StatusSchema,
    handler: async (input: z.infer<typeof StatusSchema>) => {
      try {
        const run = await readRun(input.runId);
        if (!run) return errorResult("run-status", "RUN_NOT_FOUND", `Ejecución no encontrada: ${input.runId}`);
        return okResult(run, "run-status");
      } catch (err) {
        return errorResult("run-status", "STATUS_ERROR", `Error: ${err}`);
      }
    },
  };
}
