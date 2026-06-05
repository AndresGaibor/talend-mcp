import { getRegisteredServerTools, TOOL_NAME_ALIASES, GENERIC_TOOL_OUTPUT_SCHEMA } from "../presentation/server/tool-registry";
import type { McpToolDefinition } from "./adapt-tool";
import { adaptToolToMcp } from "./adapt-tool";
import { LEGACY_TO_CANONICAL } from "../modules/legacy/legacy-aliases";
import { createLegacyAliasTool } from "../modules/legacy/create-legacy-alias-tool";
import { getPresentationAppLauncherTools } from "../presentation/apps/app-registry";

import { createSnapshotsListTool } from "../modules/snapshots/tools/snapshots-list.tool";
import { createSnapshotsCreateTool } from "../modules/snapshots/tools/snapshots-create.tool";
import { createSnapshotsDiffTool } from "../modules/snapshots/tools/snapshots-diff.tool";
import { createSnapshotsRestoreTool } from "../modules/snapshots/tools/snapshots-restore.tool";
import { createSnapshotsReadTool } from "../modules/snapshots/tools/snapshots-read.tool";

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
import { talendCanReadProjectTool, talendCanReadProcessTool, talendCanReadMetadataTool } from "../modules/jobs/tools/doctor-can-read.tool";
import { talendJobsListPatternsTool } from "../modules/jobs/tools/jobs-list-patterns.tool";

import { createListRunsTool } from "../presentation/tools/execution/list-runs.tool";
import { createReadRunTool } from "../presentation/tools/execution/read-run.tool";
import { createRunJobTool } from "../presentation/tools/execution/run-job.tool";
import { createRunExportedJobTool } from "../presentation/tools/execution/run-exported-job.tool";

export type RuntimeTool = {
  definition: McpToolDefinition;
  handler: (input: unknown) => Promise<unknown>;
};

let toolCache: Map<string, RuntimeTool> | null = null;
let aliasCache: Map<string, string> | null = null;

function getModuleTools(): RuntimeTool[] {
  const rawTools = [
    createSnapshotsListTool(),
    createSnapshotsCreateTool(),
    createSnapshotsDiffTool(),
    createSnapshotsRestoreTool(),
    createSnapshotsReadTool(),
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
    talendCanReadProjectTool,
    talendCanReadProcessTool,
    talendCanReadMetadataTool,
    talendJobsListPatternsTool,
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

export function buildRuntimeToolCache(): void {
  if (toolCache !== null) return;

  const cache = new Map<string, RuntimeTool>();

  // 1. Herramientas legacy (incluyendo alias configurados en tool-registry)
  const legacyTools = getRegisteredServerTools();
  for (const tool of legacyTools) {
    const definition = adaptToolToMcp(tool);
    cache.set(definition.name, {
      definition,
      handler: tool.handler,
    });
  }

  // 2. Herramientas de módulo (Canónicas)
  // Estas tienen prioridad y sobrescriben a las legacy si hay colisión de nombres
  const modules = getModuleTools();
  for (const tool of modules) {
    if (!tool.definition.outputSchema) {
      (tool.definition as any).outputSchema = GENERIC_TOOL_OUTPUT_SCHEMA;
    }
    cache.set(tool.definition.name, tool);
  }

  // 3. Lanzadores de Apps (Presentation Apps)
  const appLaunchers = getPresentationAppLauncherTools();
  for (const launcher of appLaunchers) {
    if (!launcher.definition.outputSchema) {
      (launcher.definition as any).outputSchema = GENERIC_TOOL_OUTPUT_SCHEMA;
    }
    cache.set(launcher.definition.name, launcher as RuntimeTool);
  }

  // 4. Alias adicionales (LEGACY_TO_CANONICAL)
  // Si una herramienta canónica existe, creamos el alias legacy apuntando a su handler con advertencia
  for (const [legacyName, canonicalName] of LEGACY_TO_CANONICAL) {
    const canonicalTool = cache.get(canonicalName);
    if (canonicalTool) {
      cache.set(legacyName, createLegacyAliasTool(legacyName, canonicalTool));
    }
  }

  // 5. Alias de la presentación (TOOL_NAME_ALIASES)
  // Envolvemos los alias existentes con advertencias de deprecación
  for (const [sourceName, aliasName] of Object.entries(TOOL_NAME_ALIASES)) {
    const canonicalTool = cache.get(sourceName);
    if (canonicalTool && cache.has(aliasName)) {
      cache.set(aliasName, createLegacyAliasTool(aliasName, canonicalTool));
    }
  }

  toolCache = cache;
  aliasCache = new Map(Object.entries(TOOL_NAME_ALIASES));
}

export function getAllRuntimeTools(): McpToolDefinition[] {
  buildRuntimeToolCache();
  return Array.from(toolCache!.values()).map((t) => t.definition);
}

export function getRuntimeTools(): RuntimeTool[] {
  buildRuntimeToolCache();
  return Array.from(toolCache!.values());
}

export function getToolByName(name: string): McpToolDefinition | undefined {
  buildRuntimeToolCache();
  return toolCache!.get(name)?.definition;
}

export function getLegacyAliases(): Map<string, string> {
  buildRuntimeToolCache();
  return aliasCache!;
}
