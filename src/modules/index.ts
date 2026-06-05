import type { McpToolDefinition } from "../server/adapt-tool";
import { adaptToolToMcp } from "../server/adapt-tool";

import { createSnapshotsListTool } from "./snapshots/tools/snapshots-list.tool";
import { createSnapshotsCreateTool } from "./snapshots/tools/snapshots-create.tool";
import { createSnapshotsDiffTool } from "./snapshots/tools/snapshots-diff.tool";
import { createSnapshotsRestoreTool } from "./snapshots/tools/snapshots-restore.tool";

import { createSecretsScanProjectTool } from "./secrets/tools/secrets-scan-project.tool";
import { createSecretsScanJobTool } from "./secrets/tools/secrets-scan-job.tool";
import { createSecretsSuggestContextMigrationTool } from "./secrets/tools/secrets-suggest-context-migration.tool";

import { createInspectCsvFolderTool } from "./datasets/tools/datasets-inspect-csv-folder.tool";
import { createInferCsvSchemaTool } from "./datasets/tools/datasets-infer-csv-schema.tool";
import { createGenerateRawMappingsTool } from "./datasets/tools/datasets-generate-raw-mappings.tool";

import { createDeliverablesCollectTool } from "./deliverables/tools/deliverables-collect";
import { createDeliverablesValidateTool } from "./deliverables/tools/deliverables-validate";
import { createDeliverablesCreatePackageTool } from "./deliverables/tools/deliverables-create-package";
import { createDeliverablesExportJobTool } from "./deliverables/tools/deliverables-export-job";

import { talendDiagnoseJobTool } from "./jobs/tools/diagnose-job.tool";
import { createJobsListTool } from "./jobs/tools/jobs-list.tool";
import { createJobsReadTool } from "./jobs/tools/jobs-read.tool";
import { createJobsCreateTool } from "./jobs/tools/jobs-create.tool";
import { createJobsPatchComponentTool } from "./jobs/tools/jobs-patch-component.tool";
import { createJobsPreviewPipelineSpecTool } from "./jobs/tools/jobs-preview-pipeline-spec.tool";
import { createJobsValidatePipelineSpecTool } from "./jobs/tools/jobs-validate-pipeline-spec.tool";
import { createJobsApplyPipelineSpecTool } from "./jobs/tools/jobs-apply-pipeline-spec.tool";
import { talendReportGenerateSnippetsTool } from "./jobs/tools/report-generate-snippets.tool";

import { createAppSessionCreateTool } from "./apps/session/tools/app-session-create.tool";
import { createAppSessionGetTool } from "./apps/session/tools/app-session-get.tool";
import { createAppSessionUpdateTool } from "./apps/session/tools/app-session-update.tool";
import { createAppSessionClearTool } from "./apps/session/tools/app-session-clear.tool";

import { createListRunsTool } from "./runs/tools/list-runs.tool";
import { createReadRunTool } from "./runs/tools/read-run.tool";
import { createRunJobTool } from "./runs/tools/run-job.tool";
import { createRunExportedJobTool } from "./runs/tools/run-exported-job.tool";

export function createModuleTools(): McpToolDefinition[] {
  const tools: McpToolDefinition[] = [];

  tools.push(adaptToolToMcp(createSnapshotsListTool()));
  tools.push(adaptToolToMcp(createSnapshotsCreateTool()));
  tools.push(adaptToolToMcp(createSnapshotsDiffTool()));
  tools.push(adaptToolToMcp(createSnapshotsRestoreTool()));

  tools.push(adaptToolToMcp(createSecretsScanProjectTool()));
  tools.push(adaptToolToMcp(createSecretsScanJobTool()));
  tools.push(adaptToolToMcp(createSecretsSuggestContextMigrationTool()));

  tools.push(adaptToolToMcp(createInspectCsvFolderTool({} as any)));
  tools.push(adaptToolToMcp(createInferCsvSchemaTool({} as any, {} as any)));
  tools.push(adaptToolToMcp(createGenerateRawMappingsTool({} as any, {} as any)));

  tools.push(adaptToolToMcp(createDeliverablesCollectTool()));
  tools.push(adaptToolToMcp(createDeliverablesValidateTool()));
  tools.push(adaptToolToMcp(createDeliverablesCreatePackageTool()));
  tools.push(adaptToolToMcp(createDeliverablesExportJobTool()));

  tools.push(adaptToolToMcp(talendDiagnoseJobTool));
  tools.push(adaptToolToMcp(createJobsListTool()));
  tools.push(adaptToolToMcp(createJobsReadTool()));
  tools.push(adaptToolToMcp(createJobsCreateTool()));
  tools.push(adaptToolToMcp(createJobsPatchComponentTool()));
  tools.push(adaptToolToMcp(createJobsPreviewPipelineSpecTool()));
  tools.push(adaptToolToMcp(createJobsValidatePipelineSpecTool()));
  tools.push(adaptToolToMcp(createJobsApplyPipelineSpecTool()));
  tools.push(adaptToolToMcp(talendReportGenerateSnippetsTool));

  tools.push(adaptToolToMcp(createAppSessionCreateTool()));
  tools.push(adaptToolToMcp(createAppSessionGetTool()));
  tools.push(adaptToolToMcp(createAppSessionUpdateTool()));
  tools.push(adaptToolToMcp(createAppSessionClearTool()));

  tools.push(adaptToolToMcp(createListRunsTool()));
  tools.push(adaptToolToMcp(createReadRunTool()));
  tools.push(adaptToolToMcp(createRunJobTool()));
  tools.push(adaptToolToMcp(createRunExportedJobTool()));

  return tools;
}