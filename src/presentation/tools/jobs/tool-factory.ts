import { JobXmlRepository } from "../../../infrastructure/repositories/job-xml.repository";
import { AnalyzeJobUseCase } from "../../../application/jobs/analyze-job.usecase";
import { ListJobsUseCase } from "../../../application/jobs/list-jobs.usecase";
import { CreateJobUseCase } from "../../../application/jobs/create-job.usecase";
import { createAnalyzeJobTool } from "./analyze-job.tool";
import { createListJobsTool } from "./list-jobs.tool";
import { createCreateJobTool } from "./create-job.tool";
import { createRenameJobTool } from "./rename-job.tool";
import { createDeleteJobTool } from "./delete-job.tool";
import { createDuplicateJobTool } from "./duplicate-job.tool";
import { createMoveJobTool } from "./move-job.tool";
import { createCreateFolderTool } from "./create-folder.tool";
import { createReadJobTool } from "./read-job.tool";
import { createListComponentsTool } from "./list-components.tool";
import { createShowFlowTool } from "./show-flow.tool";
import { createReadContextsTool } from "./read-contexts.tool";

export interface ToolDefs {
  analyzeJob: ReturnType<typeof createAnalyzeJobTool>;
  listJobs: ReturnType<typeof createListJobsTool>;
  createJob: ReturnType<typeof createCreateJobTool>;
  renameJob: ReturnType<typeof createRenameJobTool>;
  deleteJob: ReturnType<typeof createDeleteJobTool>;
  duplicateJob: ReturnType<typeof createDuplicateJobTool>;
  moveJob: ReturnType<typeof createMoveJobTool>;
  createFolder: ReturnType<typeof createCreateFolderTool>;
  readJob: ReturnType<typeof createReadJobTool>;
  listComponents: ReturnType<typeof createListComponentsTool>;
  showFlow: ReturnType<typeof createShowFlowTool>;
  readContexts: ReturnType<typeof createReadContextsTool>;
}

export function createAllJobTools(): ToolDefs {
  const jobRepo = new JobXmlRepository();

  const analyzeJobUseCase = new AnalyzeJobUseCase(jobRepo);
  const listJobsUseCase = new ListJobsUseCase(jobRepo);
  const createJobUseCase = new CreateJobUseCase(jobRepo);

  return {
    analyzeJob: createAnalyzeJobTool(analyzeJobUseCase),
    listJobs: createListJobsTool(listJobsUseCase),
    createJob: createCreateJobTool(),
    renameJob: createRenameJobTool(),
    deleteJob: createDeleteJobTool(),
    duplicateJob: createDuplicateJobTool(),
    moveJob: createMoveJobTool(),
    createFolder: createCreateFolderTool(),
    readJob: createReadJobTool(),
    listComponents: createListComponentsTool(),
    showFlow: createShowFlowTool(),
    readContexts: createReadContextsTool(),
  };
}