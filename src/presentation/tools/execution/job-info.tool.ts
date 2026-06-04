import { getJobExecutionInfo } from "../../../talend/executor";
import { ok, fail } from "../common/response";
import { wrapHandler } from "../common/logger";

export function createJobInfoTool() {
  return {
    name: "talend_job_info",
    description: "Obtiene información de ejecución de un job: ruta del item, propiedades y script.",
    inputSchema: {
      type: "object",
      properties: {
        jobName: { type: "string", description: "Nombre del job (opcional, usa el primer job si no se especifica)" },
      },
    },
    handler: wrapHandler(async (input: { jobName?: string }) => {
      const start = Date.now();
      try {
        const info = await getJobExecutionInfo(input.jobName);
        if (!info) {
          return fail("JOB_NOT_FOUND", `Job no encontrado: ${input.jobName ?? "ninguno"}`, { startTime: start });
        }
        return ok(info, { startTime: start });
      } catch (err) {
        return fail("JOB_INFO_ERROR", `Error obteniendo info del job: ${err instanceof Error ? err.message : String(err)}`, { startTime: start });
      }
    }),
  };
}