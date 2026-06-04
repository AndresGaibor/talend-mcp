import type { ListJobsUseCase } from "../../../application/jobs/list-jobs.usecase";
import { okResult, errorResult } from "../common/result";

export function createListJobsTool(listJobsUseCase: ListJobsUseCase) {
  return {
    name: "talend_list_jobs",
    description: "Lista todos los jobs en un proyecto Talend.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: { type: "string", description: "Ruta del proyecto Talend" },
      },
      required: ["projectPath"],
    },
    handler: async (input: { projectPath: string }) => {
      try {
        const jobs = await listJobsUseCase.execute(input.projectPath);
        return okResult({ jobs, count: jobs.length }, "list-jobs");
      } catch (err) {
        return errorResult("list-jobs", "LIST_JOBS_ERROR", `Error listando jobs: ${err}`);
      }
    },
  };
}