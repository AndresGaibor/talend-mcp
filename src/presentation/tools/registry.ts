import { JobXmlRepository } from "../../infrastructure/repositories/job-xml.repository";
import { AnalyzeJobUseCase } from "../../application/jobs/analyze-job.usecase";
import { ListJobsUseCase } from "../../application/jobs/list-jobs.usecase";
import { CreateJobUseCase } from "../../application/jobs/create-job.usecase";

import { createAnalyzeJobTool } from "./jobs/analyze-job.tool";
import { createCreateJobTool } from "./jobs/create-job.tool";
import { createCreateFolderTool } from "./jobs/create-folder.tool";
import { createDeleteJobTool } from "./jobs/delete-job.tool";
import { createDuplicateJobTool } from "./jobs/duplicate-job.tool";
import { createListComponentsTool } from "./jobs/list-components.tool";
import { createListJobsTool } from "./jobs/list-jobs.tool";
import { createMoveJobTool } from "./jobs/move-job.tool";
import { createReadContextsTool } from "./jobs/read-contexts.tool";
import { createReadJobTool } from "./jobs/read-job.tool";
import { createRenameJobTool } from "./jobs/rename-job.tool";
import { createShowFlowTool } from "./jobs/show-flow.tool";

import { createAnalyzeLogsTool } from "./analysis/analyze-logs.tool";
import { createAnalyzeTdbOutputTool } from "./analysis/analyze-tdboutput.tool";
import { createDuplicateAnalysisTool } from "./analysis/duplicate-analysis.tool";
import { createFullAnalysisTool } from "./analysis/full-analysis.tool";
import { createInspectComponentTool } from "./analysis/inspect-component.tool";
import { createInspectJobTool } from "./analysis/inspect-job.tool";
import { createListAnalysesTool } from "./analysis/list-analyses.tool";
import { createReadAnalysisTool } from "./analysis/read-analysis.tool";
import { createReadRunLogTool } from "./analysis/read-run-log.tool";
import { createUpdateAnalysisTool } from "./analysis/update-analysis.tool";
import { createViewLogsTool } from "./analysis/view-logs.tool";

import { createAddConnectionTool } from "./components/add-connection.tool";
import { createDeleteComponentTool } from "./components/delete-component.tool";
import { createDeleteConnectionTool } from "./components/delete-connection.tool";
import { createDuplicateComponentTool } from "./components/duplicate-component.tool";
import { createMoveComponentTool } from "./components/move-component.tool";
import { createPatchComponentTool } from "./components/patch-component.tool";
import { createPreviewDeleteComponentTool } from "./components/preview-delete-component.tool";
import { createPreviewDeleteConnectionTool } from "./components/preview-delete-connection.tool";
import { createPreviewParameterTool } from "./components/preview-parameter.tool";
import { createPreviewSchemaTool } from "./components/preview-schema.tool";
import { createUpdateParameterTool } from "./components/update-parameter.tool";
import { createUpdateSchemaTool } from "./components/update-schema.tool";

import { createRepositoryContextTool } from "./contexts/create-repository-context.tool";
import { createDeleteRepositoryContextTool } from "./contexts/delete-repository-context.tool";
import { createDeleteRepositoryContextParameterTool } from "./contexts/delete-repository-context-parameter.tool";
import { createListProjectContextsTool } from "./contexts/list-project-contexts.tool";
import { createListRepositoryContextsTool } from "./contexts/list-repository-contexts.tool";
import { createReadRepositoryContextTool } from "./contexts/read-repository-context.tool";
import { createUpsertRepositoryContextParameterTool } from "./contexts/upsert-repository-context-parameter.tool";

import { createFindExportedJobsTool } from "./execution/find-exported-jobs.tool";
import { createJobInfoTool } from "./execution/job-info.tool";
import { createListRunsTool } from "./execution/list-runs.tool";
import { createReadRunTool, createTailRunOutputTool } from "./execution/read-run.tool";
import { createRunExportedJobTool } from "./execution/run-exported-job.tool";
import { createRunJobTool } from "./execution/run-job.tool";

import { createLatestChangesTool } from "./live/latest-changes.tool";
import { createLiveStartTool } from "./live/live-start.tool";
import { createLiveStatusTool } from "./live/live-status.tool";
import { createLiveStopTool } from "./live/live-stop.tool";

import { createDetectOpenJobsTool } from "./open/detect-open-jobs.tool";
import { createSummarizeOpenJobTool } from "./open/summarize-open-job.tool";

import { createRepoPullTool } from "./repo/repo-pull.tool";
import { createRepoSetupTool } from "./repo/repo-setup.tool";
import { createRepoSourcesTool } from "./repo/repo-sources.tool";
import { createRepoStatusTool } from "./repo/repo-status.tool";
import { createRepoSwitchTool } from "./repo/repo-switch.tool";

import { createDetectProcessTool } from "./studio/detect-process.tool";
import { createDiagnoseEnvironmentTool } from "./studio/diagnose-environment.tool";
import { createListLaunchConfigsTool } from "./studio/list-launch-configs.tool";
import { createListOpenEditorsTool, createGetProbableActiveJobTool } from "./studio/list-open-editors.tool";

const jobRepo = new JobXmlRepository();
const analyzeJobUseCase = new AnalyzeJobUseCase(jobRepo);
const listJobsUseCase = new ListJobsUseCase(jobRepo);
const createJobUseCase = new CreateJobUseCase(jobRepo);

export const allTools = [
  createAnalyzeJobTool(analyzeJobUseCase),
  createCreateJobTool(),
  createCreateFolderTool(),
  createDeleteJobTool(),
  createDuplicateJobTool(),
  createListComponentsTool(),
  createListJobsTool(listJobsUseCase),
  createMoveJobTool(),
  createReadContextsTool(),
  createReadJobTool(),
  createRenameJobTool(),
  createShowFlowTool(),

  createAnalyzeLogsTool(),
  createAnalyzeTdbOutputTool(),
  createDuplicateAnalysisTool(),
  createFullAnalysisTool(),
  createInspectComponentTool(),
  createInspectJobTool(),
  createListAnalysesTool(),
  createReadAnalysisTool(),
  createReadRunLogTool(),
  createUpdateAnalysisTool(),
  createViewLogsTool(),

  createAddConnectionTool(),
  createDeleteComponentTool(),
  createDeleteConnectionTool(),
  createDuplicateComponentTool(),
  createMoveComponentTool(),
  createPatchComponentTool(),
  createPreviewDeleteComponentTool(),
  createPreviewDeleteConnectionTool(),
  createPreviewParameterTool(),
  createPreviewSchemaTool(),
  createUpdateParameterTool(),
  createUpdateSchemaTool(),

  createRepositoryContextTool(),
  createDeleteRepositoryContextTool(),
  createDeleteRepositoryContextParameterTool(),
  createListProjectContextsTool(),
  createListRepositoryContextsTool(),
  createReadRepositoryContextTool(),
  createUpsertRepositoryContextParameterTool(),

  createFindExportedJobsTool(),
  createJobInfoTool(),
  createListRunsTool(),
  createReadRunTool(),
  createTailRunOutputTool(),
  createRunExportedJobTool(),
  createRunJobTool(),

  createLatestChangesTool(),
  createLiveStartTool(),
  createLiveStatusTool(),
  createLiveStopTool(),

  createDetectOpenJobsTool(),
  createSummarizeOpenJobTool(),

  createRepoPullTool(),
  createRepoSetupTool(),
  createRepoSourcesTool(),
  createRepoStatusTool(),
  createRepoSwitchTool(),

  createDetectProcessTool(),
  createDiagnoseEnvironmentTool(),
  createListLaunchConfigsTool(),
  createListOpenEditorsTool(),
  createGetProbableActiveJobTool(),
];

export const toolCount = allTools.length;