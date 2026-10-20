import type { ListJobsUseCase } from "../../../application/jobs/list-jobs.usecase";
import { resolveProjectPath } from "../../../talend/workspace";
import { okResult, errorResult } from "../common/result";

export function createListJobsTool(listJobsUseCase: ListJobsUseCase) {
  return {
    name: "talend_jobs_list",
    description: "Lista todos los jobs en un proyecto Talend.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: { type: "string", description: "Ruta del proyecto Talend (opcional, se obtiene del entorno si no se provee)" },
        limit: { type: "number", description: "Máximo de jobs a devolver", default: 50 },
        offset: { type: "number", description: "Cantidad de jobs a omitir", default: 0 },
      },
    },
    handler: async (input: { projectPath?: string; limit?: number; offset?: number }) => {
      try {
        const projectPath = input.projectPath || await resolveProjectPath();
        if (!projectPath) {
          return errorResult("list-jobs", "PROJECT_PATH_REQUIRED", "No se especificó projectPath y no se pudo detectar el proyecto Talend. Usa projectPath o define TALEND_PROJECT.");
        }

        const limit = input.limit ?? 50;
        const offset = input.offset ?? 0;
        const all = await listJobsUseCase.execute(projectPath);
        const jobs = all.slice(offset, offset + limit);

        return okResult({ jobs, count: jobs.length, total: all.length }, "list-jobs");
      } catch (err) {
        return errorResult("list-jobs", "LIST_JOBS_ERROR", `Error listando jobs: ${err}`);
      }
    },
  };
}
