// Re-export from migrated modules
export { talendDiagnoseJobTool } from "../modules/jobs/tools/diagnose-job.tool";
export { talendReportGenerateSnippetsTool } from "../modules/jobs/tools/report-generate-snippets.tool";

// Legacy tools - to be migrated
export const studioToolDefs = [
  // talendGetProbableActiveJobTool - not yet migrated
  // talendTailRunOutputTool - not yet migrated
];