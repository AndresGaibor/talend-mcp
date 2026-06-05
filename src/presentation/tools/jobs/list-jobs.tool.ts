import type { ListJobsUseCase } from "../../../application/jobs/list-jobs.usecase";
import { okResult, errorResult } from "../common/result";

export function createListJobsTool(listJobsUseCase: ListJobsUseCase) {
  return {
    name: "talend_jobs_list",
    description: "Lista todos los jobs en un proyecto Talend.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: { type: "string", description: "Ruta del proyecto Talend (opcional, se obtiene del entorno si no se provee)" },
      },
    },
    handler: async (input: { projectPath?: string }) => {
      try {
        const projectPath = input.projectPath || process.env.TALEND_PROJECT_PATH;
        if (!projectPath) {
          return errorResult("list-jobs", "PROJECT_PATH_REQUIRED", "No se especificó projectPath y no hay TALEND_PROJECT_PATH configurado. Usa projectPath o configura TALEND_PROJECT_PATH.");
        }
        const jobs = await listJobsUseCase.execute(projectPath);
        return okResult({ jobs, count: jobs.length }, "list-jobs");
      } catch (err) {
        return errorResult("list-jobs", "LIST_JOBS_ERROR", `Error listando jobs: ${err}`);
      }
    },
  };
}