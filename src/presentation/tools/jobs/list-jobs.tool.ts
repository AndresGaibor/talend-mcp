import type { ListJobsUseCase } from "../../../application/jobs/list-jobs.usecase";
import { ok, fail } from "../common/response";

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
        return ok({ jobs, count: jobs.length });
      } catch (err) {
        return fail("LIST_JOBS_ERROR", `Error listando jobs: ${err}`);
      }
    },
  };
}