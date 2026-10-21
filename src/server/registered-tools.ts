import { getRegisteredServerTools, GENERIC_TOOL_OUTPUT_SCHEMA, getRegisteredServerToolAnnotations } from "../presentation/server/tool-registry";
import type { McpToolDefinition } from "./adapt-tool";
import { adaptToolToMcp } from "./adapt-tool";


import { createSecretsSuggestContextMigrationTool } from "../modules/secrets/tools/secrets-suggest-context-migration.tool";
import { createSecretsScanProjectTool } from "../modules/secrets/tools/secrets-scan-project.tool";
import { createSecretsScanJobTool } from "../modules/secrets/tools/secrets-scan-job.tool";

import { createInspectCsvFolderTool } from "../modules/datasets/tools/datasets-inspect-csv-folder.tool";
import { createGenerateRawMappingsTool } from "../modules/datasets/tools/datasets-generate-raw-mappings.tool";
import { createInferCsvSchemaTool } from "../modules/datasets/tools/datasets-infer-csv-schema.tool";


import { talendDiagnoseJobTool } from "../modules/jobs/tools/diagnose-job.tool";
import { talendReportGenerateSnippetsTool } from "../modules/jobs/tools/report-generate-snippets.tool";

import { createRequirementsAnalyzeTool } from "../modules/requirements/tools/requirements-analyze.tool";
import { createRequirementsBuildChecklistTool } from "../modules/requirements/tools/requirements-build-checklist.tool";
import { createJobsDetectAntipatternsTool } from "../modules/jobs/tools/jobs-detect-antipatterns.tool";
import { createJobsValidatePipelineSpecTool } from "../modules/jobs/tools/jobs-validate-pipeline-spec.tool";
import { createJobsPreviewPipelineSpecTool } from "../modules/jobs/tools/jobs-preview-pipeline-spec.tool";
import { createEvidencePackBuildTool } from "../modules/evidence-pack/tools/evidence-pack-build.tool";
import { talendCanReadProjectTool, talendCanReadProcessTool, talendCanReadMetadataTool } from "../modules/jobs/tools/doctor-can-read.tool";
import { talendJobsListPatternsTool } from "../modules/jobs/tools/jobs-list-patterns.tool";

import { createListRunsTool } from "../modules/runs/tools/list-runs.tool";
import { createReadRunTool } from "../modules/runs/tools/read-run.tool";
import { createRunJobTool } from "../modules/runs/tools/run-job.tool";
import { createRunExportedJobTool } from "../modules/runs/tools/run-exported-job.tool";

import { createErrorsExplainTool } from "../modules/errors/tools/errors-explain.tool";
import { createErrorsSuggestFixTool } from "../modules/errors/tools/errors-suggest-fix.tool";
import { createErrorsStatsTool } from "../modules/errors/tools/errors-stats.tool";

import { createValidateDesignTool } from "../modules/validation/tools/validate-design.tool";
import { createValidateContextUsageTool } from "../modules/validation/tools/validate-context-usage.tool";
import { createValidateAuditColumnsTool } from "../modules/validation/tools/validate-audit-columns.tool";
import { createValidatePerformanceTool } from "../modules/validation/tools/validate-performance.tool";

import { createEvidencePackExportTool } from "../modules/evidence-pack/tools/evidence-pack-export.tool";

import { createReportSnippetsListTool } from "../modules/jobs/tools/report-snippets-list.tool";
import { createReportSnippetsGenerateTool } from "../modules/jobs/tools/report-snippets-generate.tool";

import { createRecipeGenerateTool } from "../modules/component-knowledge/tools/recipe-generate.tool";
import { createRecipeGetTool } from "../modules/component-knowledge/tools/recipe-get.tool";
import { createSchemaExtractTool } from "../modules/component-knowledge/tools/schema-extract.tool";
import { createSchemaCompareTool } from "../modules/component-knowledge/tools/schema-compare.tool";
import { createSchemaSuggestionsTool } from "../modules/component-knowledge/tools/schema-suggestions.tool";
import { createCatalogRebuildTool } from "../modules/component-knowledge/tools/catalog-rebuild.tool";
import { createJobQualityReportTool, createJobQualityIssuesTool } from "../modules/component-knowledge/tools/job-quality.tool";
import { createComponentDefinitionTool } from "../modules/component-definitions/tools/component-definition.tool";

export type RuntimeTool = {
  definition: McpToolDefinition;
  handler: (input: unknown) => Promise<unknown>;
};

let toolCache: Map<string, RuntimeTool> | null = null;

function getModuleTools(): RuntimeTool[] {
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
    const registryAnn = getRegisteredServerToolAnnotations(tool.name);
    if (registryAnn) {
      definition.annotations = {
        readOnlyHint: registryAnn.readOnlyHint,
        idempotentHint: registryAnn.idempotentHint,
        destructiveHint: registryAnn.destructiveHint,
        openWorldHint: registryAnn.openWorldHint,
        requiresConfirmation: registryAnn.requiresConfirmation ?? registryAnn.destructiveHint,
        ...definition.annotations,
      };
    }
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

  toolCache = cache;
}


// ─── Tool Presets ─────────────────────────────────────────────────────────────
// Available presets (TALEND_MCP_FILTER env var, comma-separated):
//
//   all          → todas las tools talend_*
//   canonical    → idem, sin los duplicados legacy conocidos
//   core         → 21 tools esenciales (las mas seguras para clientes limitados)
//   jobs         → talend_jobs_* + tools de job relacionadas
//   snapshots    → talend_snapshots_*
//   runs         → tools de ejecucion
//   errors       → talend_errors_*
//   validation   → talend_validation_*
//   secrets      → talend_secrets_*
//   datasets     → talend_datasets_*
//   deliverables → talend_deliverables_*
//   components   → talend_components_*
//   bridge       → talend_bridge_*
//   requirements → talend_requirements_*
//   evidence     → talend_evidence_*
//   reports      → talend_report_snippets_*
//
// Presets are additive: TALEND_MCP_FILTER="core,jobs"
// Wildcards work too:  TALEND_MCP_FILTER="talend_bridge_*"

// 21-tool curated safe set
const PRESET_CORE = new Set([
  "talend_jobs_list",
  "talend_jobs_read",
  "talend_show_flow",
  "talend_read_contexts",
  "talend_detect_open_jobs",
  "talend_summarize_open_job",
  "talend_diagnose_environment",
  "talend_bridge_ping",
  "talend_runs_list",
  "talend_runs_read",
  "talend_job_run_by_name",
  "talend_list_project_contexts",
  "talend_list_repository_contexts",
  "talend_read_repository_context",
  "talend_secrets_scan_project",
  "talend_secrets_scan_job",
  "talend_validation_validate_design",
  "talend_validation_validate_context_usage",
  "talend_errors_stats",
  "talend_errors_explain",
  "talend_errors_suggest_fix",
]);

/**
 * Nombres legacy que siguen existiendo como tool y duplican una canonica.
 * Se ocultan en el preset "canonical" para no exponer la misma capacidad dos
 * veces. Si una tool deja de existir, hay que quitarla de esta lista.
 */
const LEGACY_TALEND_ALIASES = new Set([
  "talend_report_generate_snippets",          // → talend_report_snippets_generate
]);

const KNOWN_PRESETS = new Set([
  "all", "canonical", "core", "jobs", "snapshots", "runs", "errors",
  "validation", "secrets", "datasets", "deliverables", "components", "bridge",
  "requirements", "evidence", "reports",
]);

function applyFilter<T extends { name: string } | { definition: { name: string } }>(
  items: T[],
  filterStr: string | undefined
): T[] {
  if (!filterStr) return items;

  const patterns = filterStr.split(",").map(p => p.trim().toLowerCase());

  const wantsAll          = patterns.includes("all");
  const wantsCanonical    = patterns.includes("canonical");
  const wantsCore         = patterns.includes("core");
  const wantsJobs         = patterns.includes("jobs");
  const wantsSnapshots    = patterns.includes("snapshots");
  const wantsRuns         = patterns.includes("runs");
  const wantsErrors       = patterns.includes("errors");
  const wantsValidation   = patterns.includes("validation");
  const wantsSecrets      = patterns.includes("secrets");
  const wantsDatasets     = patterns.includes("datasets");
  const wantsDeliverables = patterns.includes("deliverables");
  const wantsComponents   = patterns.includes("components");
  const wantsBridge       = patterns.includes("bridge");
  const wantsRequirements = patterns.includes("requirements");
  const wantsEvidence     = patterns.includes("evidence");
  const wantsReports      = patterns.includes("reports");

  const customPatterns = patterns.filter(p => !KNOWN_PRESETS.has(p));

  return items.filter(item => {
    const name = ("name" in item ? item.name : (item as any).definition.name).toLowerCase();

    // "all": todas las tools talend_*
    if (wantsAll && name.startsWith("talend_")) return true;

    // "canonical": toda tool talend_* que no sea un duplicado legacy conocido
    if (wantsCanonical && name.startsWith("talend_") && !LEGACY_TALEND_ALIASES.has(name)) return true;

    // "core": set curado de 21 tools seguras
    if (wantsCore && PRESET_CORE.has(name)) return true;

    // Module presets by prefix
    if (wantsBridge       && name.startsWith("talend_bridge_")) return true;
    if (wantsComponents   && name.startsWith("talend_components_")) return true;
    if (wantsErrors       && name.startsWith("talend_errors_")) return true;
    if (wantsValidation   && name.startsWith("talend_validation_")) return true;
    if (wantsSecrets      && name.startsWith("talend_secrets_")) return true;
    if (wantsDatasets     && name.startsWith("talend_datasets_")) return true;
    if (wantsDeliverables && name.startsWith("talend_deliverables_")) return true;
    if (wantsRequirements && name.startsWith("talend_requirements_")) return true;
    if (wantsEvidence     && name.startsWith("talend_evidence_")) return true;
    if (wantsReports      && name.startsWith("talend_report_snippets_")) return true;
    if (wantsSnapshots    && name.startsWith("talend_snapshots_")) return true;
    if (wantsRuns && (
      name === "talend_runs_list"      || name === "talend_runs_read"         ||
      name === "talend_tail_run_output" || name === "talend_read_run_log"     ||
      name === "talend_job_run_by_name" || name === "talend_job_wait_run"     ||
      name === "talend_run_exported_job" || name === "talend_runs_collect_logs" ||
      name === "talend_runs_analyze_output"
    )) return true;
    if (wantsJobs && (
      name.startsWith("talend_jobs_") ||
      name === "talend_show_flow"           || name === "talend_read_contexts"     ||
      name === "talend_detect_open_jobs"    || name === "talend_summarize_open_job" ||
      name === "talend_diagnose_environment"|| name === "talend_can_read_project"  ||
      name === "talend_can_read_process"    || name === "talend_can_read_metadata"
    )) return true;

    // Custom exact name or wildcard
    return customPatterns.some(pattern => {
      if (pattern.endsWith("*")) return name.startsWith(pattern.slice(0, -1));
      return name === pattern;
    });
  });
}

export function getAllRuntimeTools(): McpToolDefinition[] {
  buildRuntimeToolCache();
  const tools = Array.from(toolCache!.values()).map((t) => t.definition);
  return applyFilter(tools, process.env.TALEND_MCP_FILTER);
}

export function getRuntimeTools(): RuntimeTool[] {
  buildRuntimeToolCache();
  const tools = Array.from(toolCache!.values());
  return applyFilter(tools, process.env.TALEND_MCP_FILTER);
}

export function getToolByName(name: string): McpToolDefinition | undefined {
  buildRuntimeToolCache();
  return toolCache!.get(name)?.definition;
}
