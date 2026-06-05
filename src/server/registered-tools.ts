import { getRegisteredServerTools, TOOL_NAME_ALIASES } from "../presentation/server/tool-registry";
import type { McpToolDefinition } from "./adapt-tool";
import { adaptToolToMcp } from "./adapt-tool";

import { createSnapshotsListTool } from "../modules/snapshots/tools/snapshots-list.tool";
import { createSnapshotsCreateTool } from "../modules/snapshots/tools/snapshots-create.tool";
import { createSnapshotsDiffTool } from "../modules/snapshots/tools/snapshots-diff.tool";
import { createSnapshotsRestoreTool } from "../modules/snapshots/tools/snapshots-restore.tool";

import { createSecretsSuggestContextMigrationTool } from "../modules/secrets/tools/secrets-suggest-context-migration.tool";
import { createSecretsScanProjectTool } from "../modules/secrets/tools/secrets-scan-project.tool";
import { createSecretsScanJobTool } from "../modules/secrets/tools/secrets-scan-job.tool";

import { createInspectCsvFolderTool } from "../modules/datasets/tools/datasets-inspect-csv-folder.tool";
import { createGenerateRawMappingsTool } from "../modules/datasets/tools/datasets-generate-raw-mappings.tool";
import { createInferCsvSchemaTool } from "../modules/datasets/tools/datasets-infer-csv-schema.tool";

import { createDeliverablesExportJobTool } from "../modules/deliverables/tools/deliverables-export-job";
import { createDeliverablesCollectTool } from "../modules/deliverables/tools/deliverables-collect";
import { createDeliverablesCreatePackageTool } from "../modules/deliverables/tools/deliverables-create-package";
import { createDeliverablesValidateTool } from "../modules/deliverables/tools/deliverables-validate";

import { talendDiagnoseJobTool } from "../modules/jobs/tools/diagnose-job.tool";
import { createJobsReadTool } from "../modules/jobs/tools/jobs-read.tool";
import { talendReportGenerateSnippetsTool } from "../modules/jobs/tools/report-generate-snippets.tool";
import { createJobsPatchComponentTool } from "../modules/jobs/tools/jobs-patch-component.tool";
import { createJobsPreviewPipelineSpecTool } from "../modules/jobs/tools/jobs-preview-pipeline-spec.tool";
import { createJobsValidatePipelineSpecTool } from "../modules/jobs/tools/jobs-validate-pipeline-spec.tool";
import { createJobsApplyPipelineSpecTool } from "../modules/jobs/tools/jobs-apply-pipeline-spec.tool";
import { createJobsCreateTool } from "../modules/jobs/tools/jobs-create.tool";
import { createJobsListTool } from "../modules/jobs/tools/jobs-list.tool";

import { createAppSessionCreateTool } from "../modules/apps/session/tools/app-session-create.tool";
import { createAppSessionGetTool } from "../modules/apps/session/tools/app-session-get.tool";
import { createAppSessionUpdateTool } from "../modules/apps/session/tools/app-session-update.tool";
import { createAppSessionClearTool } from "../modules/apps/session/tools/app-session-clear.tool";
import { createRequirementsAnalyzeTool } from "../modules/requirements/tools/requirements-analyze.tool";
import { createRequirementsBuildChecklistTool } from "../modules/requirements/tools/requirements-build-checklist.tool";
import { createJobsDetectAntipatternsTool } from "../modules/jobs/tools/jobs-detect-antipatterns.tool";
import { createEvidencePackBuildTool } from "../modules/evidence-pack/tools/evidence-pack-build.tool";

import { createListRunsTool } from "../presentation/tools/execution/list-runs.tool";
import { createReadRunTool } from "../presentation/tools/execution/read-run.tool";
import { createRunJobTool } from "../presentation/tools/execution/run-job.tool";
import { createRunExportedJobTool } from "../presentation/tools/execution/run-exported-job.tool";

export type RuntimeTool = {
  definition: McpToolDefinition;
  handler: (input: unknown) => Promise<unknown>;
};

function getModuleTools(): RuntimeTool[] {
  const rawTools = [
    createSnapshotsListTool(),
    createSnapshotsCreateTool(),
    createSnapshotsDiffTool(),
    createSnapshotsRestoreTool(),
    createSecretsScanProjectTool(),
    createSecretsScanJobTool(),
    createSecretsSuggestContextMigrationTool(),
    createInspectCsvFolderTool({} as any),
    createGenerateRawMappingsTool({} as any, {} as any),
    createInferCsvSchemaTool({} as any, {} as any),
    createDeliverablesExportJobTool(),
    createDeliverablesCollectTool(),
    createDeliverablesCreatePackageTool(),
    createDeliverablesValidateTool(),
    talendDiagnoseJobTool,
    createJobsListTool(),
    createJobsReadTool(),
    talendReportGenerateSnippetsTool,
    createJobsPatchComponentTool(),
    createJobsPreviewPipelineSpecTool(),
    createJobsValidatePipelineSpecTool(),
    createJobsApplyPipelineSpecTool(),
    createJobsCreateTool(),
    createAppSessionCreateTool(),
    createAppSessionGetTool(),
    createAppSessionUpdateTool(),
    createAppSessionClearTool(),
    createRequirementsAnalyzeTool(),
    createRequirementsBuildChecklistTool(),
    createJobsDetectAntipatternsTool(),
    createEvidencePackBuildTool(),
    createListRunsTool(),
    createReadRunTool(),
    createRunJobTool(),
    createRunExportedJobTool(),
  ];

  return rawTools.map((tool) => ({
    definition: adaptToolToMcp(tool),
    handler: tool.handler as (input: unknown) => Promise<unknown>,
  }));
}

let cachedTools: McpToolDefinition[] | null = null;
let cachedAliases: Map<string, string> | null = null;

function buildCache(): void {
  if (cachedTools !== null) return;

  const legacyTools = getRegisteredServerTools().map((tool) =>
    adaptToolToMcp(tool as any)
  );
  const moduleTools = getModuleTools();

  const combined = [...legacyTools, ...moduleTools];
  const seen = new Set<string>();
  const deduplicated: McpToolDefinition[] = [];

  for (const tool of combined) {
    const toolName = "definition" in tool ? tool.definition.name : (tool as McpToolDefinition).name;
    if (!seen.has(toolName)) {
      seen.add(toolName);
      deduplicated.push(tool as McpToolDefinition);
    }
  }

  cachedTools = deduplicated;
  cachedAliases = new Map(Object.entries(TOOL_NAME_ALIASES));
}

export function getAllRuntimeTools(): McpToolDefinition[] {
  buildCache();
  return cachedTools!;
}

export function getRuntimeTools(): RuntimeTool[] {
  buildCache();
  return getModuleTools();
}

export function getToolByName(name: string): McpToolDefinition | undefined {
  buildCache();
  return cachedTools!.find((tool) => tool.name === name);
}

export function getLegacyAliases(): Map<string, string> {
  buildCache();
  return cachedAliases!;
}