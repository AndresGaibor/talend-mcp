import type { McpToolDefinition } from "../adapt-tool";
import { adaptToolToMcp } from "../adapt-tool";
import type { RuntimeTool } from "./types";

import { createSecretsSuggestContextMigrationTool } from "../../modules/secrets/tools/secrets-suggest-context-migration.tool";
import { createSecretsScanProjectTool } from "../../modules/secrets/tools/secrets-scan-project.tool";
import { createSecretsScanJobTool } from "../../modules/secrets/tools/secrets-scan-job.tool";

import { createInspectCsvFolderTool } from "../../modules/datasets/tools/datasets-inspect-csv-folder.tool";
import { createGenerateRawMappingsTool } from "../../modules/datasets/tools/datasets-generate-raw-mappings.tool";
import { createInferCsvSchemaTool } from "../../modules/datasets/tools/datasets-infer-csv-schema.tool";

import { talendDiagnoseJobTool } from "../../modules/jobs/tools/diagnose-job.tool";
import { talendReportGenerateSnippetsTool } from "../../modules/jobs/tools/report-generate-snippets.tool";

import { createRequirementsAnalyzeTool } from "../../modules/requirements/tools/requirements-analyze.tool";
import { createRequirementsBuildChecklistTool } from "../../modules/requirements/tools/requirements-build-checklist.tool";
import { createJobsDetectAntipatternsTool } from "../../modules/jobs/tools/jobs-detect-antipatterns.tool";
import { createJobsValidatePipelineSpecTool } from "../../modules/jobs/tools/jobs-validate-pipeline-spec.tool";
import { createJobsPreviewPipelineSpecTool } from "../../modules/jobs/tools/jobs-preview-pipeline-spec.tool";
import { createEvidencePackBuildTool } from "../../modules/evidence-pack/tools/evidence-pack-build.tool";
import { talendCanReadProjectTool, talendCanReadProcessTool, talendCanReadMetadataTool } from "../../modules/jobs/tools/doctor-can-read.tool";
import { talendJobsListPatternsTool } from "../../modules/jobs/tools/jobs-list-patterns.tool";

import { createListRunsTool } from "../../modules/runs/tools/list-runs.tool";
import { createReadRunTool } from "../../modules/runs/tools/read-run.tool";
import { createRunJobTool } from "../../modules/runs/tools/run-job.tool";
import { createRunExportedJobTool } from "../../modules/runs/tools/run-exported-job.tool";

import { createErrorsExplainTool } from "../../modules/errors/tools/errors-explain.tool";
import { createErrorsSuggestFixTool } from "../../modules/errors/tools/errors-suggest-fix.tool";
import { createErrorsStatsTool } from "../../modules/errors/tools/errors-stats.tool";

import { createValidateDesignTool } from "../../modules/validation/tools/validate-design.tool";
import { createValidateContextUsageTool } from "../../modules/validation/tools/validate-context-usage.tool";
import { createValidateAuditColumnsTool } from "../../modules/validation/tools/validate-audit-columns.tool";
import { createValidatePerformanceTool } from "../../modules/validation/tools/validate-performance.tool";

import { createEvidencePackExportTool } from "../../modules/evidence-pack/tools/evidence-pack-export.tool";

import { createReportSnippetsListTool } from "../../modules/jobs/tools/report-snippets-list.tool";
import { createReportSnippetsGenerateTool } from "../../modules/jobs/tools/report-snippets-generate.tool";

import { createRecipeGenerateTool } from "../../modules/component-knowledge/tools/recipe-generate.tool";
import { createRecipeGetTool } from "../../modules/component-knowledge/tools/recipe-get.tool";
import { createSchemaExtractTool } from "../../modules/component-knowledge/tools/schema-extract.tool";
import { createSchemaCompareTool } from "../../modules/component-knowledge/tools/schema-compare.tool";
import { createSchemaSuggestionsTool } from "../../modules/component-knowledge/tools/schema-suggestions.tool";
import { createCatalogRebuildTool } from "../../modules/component-knowledge/tools/catalog-rebuild.tool";
import { createJobQualityReportTool, createJobQualityIssuesTool } from "../../modules/component-knowledge/tools/job-quality.tool";
import { createComponentDefinitionTool } from "../../modules/component-definitions/tools/component-definition.tool";
import { createAgentGuideTool } from "../../modules/guide/tools/agent-guide.tool";

/**
 * Construye las tools de modulo (canonicas) en orden de registro.
 * El listado se inyecta para que la guia consulte el catalogo ya filtrado sin
 * que este modulo importe la cache de runtime.
 */
export function getModuleTools(listTools: () => McpToolDefinition[]): RuntimeTool[] {
  const rawTools = [
    createSecretsScanProjectTool(),
    createSecretsScanJobTool(),
    createSecretsSuggestContextMigrationTool(),
    createInspectCsvFolderTool({} as any),
    createGenerateRawMappingsTool({} as any, {} as any),
    createInferCsvSchemaTool({} as any, {} as any),
    talendDiagnoseJobTool,
    talendReportGenerateSnippetsTool,
    createRequirementsAnalyzeTool(),
    createRequirementsBuildChecklistTool(),
    createJobsDetectAntipatternsTool(),
    createJobsValidatePipelineSpecTool(),
    createJobsPreviewPipelineSpecTool(),
    createEvidencePackBuildTool(),
    talendCanReadProjectTool,
    talendCanReadProcessTool,
    talendCanReadMetadataTool,
    talendJobsListPatternsTool,
    createListRunsTool(),
    createReadRunTool(),
    createRunJobTool(),
    createRunExportedJobTool(),
    createErrorsExplainTool(),
    createErrorsSuggestFixTool(),
    createErrorsStatsTool(),
    createValidateDesignTool(),
    createValidateContextUsageTool(),
    createValidateAuditColumnsTool(),
    createValidatePerformanceTool(),
    createEvidencePackExportTool(),
    createReportSnippetsListTool(),
    createReportSnippetsGenerateTool(),
    createRecipeGenerateTool(),
    createRecipeGetTool(),
    createSchemaExtractTool(),
    createSchemaCompareTool(),
    createSchemaSuggestionsTool(),
    createCatalogRebuildTool(),
    createJobQualityReportTool(),
    createJobQualityIssuesTool(),
    createComponentDefinitionTool(),
    createAgentGuideTool({ listTools }),
  ];

  return rawTools.map((tool) => ({
    definition: adaptToolToMcp(tool),
    handler: tool.handler as (input: unknown) => Promise<unknown>,
  }));
}
