import { findExportedJobScripts } from "../../../talend/runner/exported-job-finder";
import { ok, fail } from "../common/response";
import { wrapHandler } from "../common/logger";

export function createFindExportedJobsTool() {
  return {
    name: "talend_find_exported_jobs",
    description: "Busca scripts de jobs exportados (*_run.sh, *_run.bat) en TALEND_BUILDS_DIR.",
    inputSchema: {
      type: "object",
      properties: {
        jobName: { type: "string", description: "Filtrar por nombre de job específico (opcional)" },
        buildsDir: { type: "string", description: "Directorio de builds (default: TALEND_BUILDS_DIR)" },
      },
    },
    handler: wrapHandler(async (input: { jobName?: string; buildsDir?: string }) => {
      const start = Date.now();
      try {
        const result = await findExportedJobScripts({ jobName: input.jobName, buildsDir: input.buildsDir });
        if (!result.ok) {
          return fail("FIND_EXPORTED_JOBS_ERROR", result.error ?? "Error buscando jobs exportados", { startTime: start });
        }
        return ok(result.data, { startTime: start });
      } catch (err) {
        return fail("FIND_EXPORTED_JOBS_ERROR", `Error buscando jobs exportados: ${err instanceof Error ? err.message : String(err)}`, { startTime: start });
      }
    }),
  };
}