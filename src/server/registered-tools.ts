import { getRegisteredServerTools, TOOL_NAME_ALIASES, GENERIC_TOOL_OUTPUT_SCHEMA, getRegisteredServerToolAnnotations } from "../presentation/server/tool-registry";
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

  const mergedAliases = new Map<string, string>();
  for (const [legacyName, canonicalName] of Object.entries(TOOL_NAME_ALIASES)) {
    mergedAliases.set(legacyName, canonicalName);
  }
  for (const [legacyName, canonicalName] of LEGACY_TO_CANONICAL) {
    mergedAliases.set(legacyName, canonicalName);
  }
  aliasCache = mergedAliases;
}


// ─── Tool Presets ─────────────────────────────────────────────────────────────
// Available presets (TALEND_MCP_FILTER env var, comma-separated):
//
//   all          → All talend_* tools, no non-prefixed legacy aliases (~252 tools)
//   canonical    → Same as "all" but removes known legacy duplicate names (~215 tools)
//   core         → 21 curated essential tools (~10KB, safest for limited clients)
//   apps         → talend_app_* UI launchers only
//   jobs         → talend_jobs_* + related job tools
//   snapshots    → talend_snapshots_*
//   runs         → run-related tools
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
// Presets are additive: TALEND_MCP_FILTER="core,apps"
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
  "talend_list_runs",
  "talend_read_run",
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

// Known legacy duplicate aliases within the talend_* namespace.
// These point to the same handler as their newer canonical counterpart.
// Excluded from "canonical" to avoid showing duplicate tools in ChatGPT.
const LEGACY_TALEND_ALIASES = new Set([
  "talend_secret_scan_project",               // → talend_secrets_scan_project
  "talend_secret_scan_job",                   // → talend_secrets_scan_job
  "talend_secret_suggest_context_migration",  // → talend_secrets_suggest_context_migration
  "talend_snapshot_list",                     // → talend_snapshots_list
  "talend_snapshot_create",                   // → talend_snapshots_create
  "talend_snapshot_diff",                     // → talend_snapshots_diff
  "talend_snapshot_restore",                  // → talend_snapshots_restore
  "talend_snapshot_read",                     // → talend_snapshots_read
  "talend_deliverable_export_job",            // → talend_deliverables_export_job
  "talend_deliverable_collect_files",         // → talend_deliverables_collect
  "talend_deliverable_create_package",        // → talend_deliverables_create_package
  "talend_deliverable_validate_checklist",    // → talend_deliverables_validate
  "talend_dataset_inspect_csv_folder",        // → talend_datasets_inspect_csv_folder
  "talend_dataset_infer_csv_schema",          // → talend_datasets_infer_csv_schema
  "talend_dataset_generate_raw_table_mapping",   // → talend_datasets_generate_raw_mappings
  "talend_dataset_generate_raw_table_mappings",  // → talend_datasets_generate_raw_mappings
  "talend_error_explain",                     // → talend_errors_explain
  "talend_error_suggest_fix",                 // → talend_errors_suggest_fix
  "talend_error_stats",                       // → talend_errors_stats
  "talend_error_map_to_component",            // old name, no canonical equivalent
  "talend_job_validate_design",               // → talend_validation_validate_design
  "talend_job_validate_context_usage",        // → talend_validation_validate_context_usage
  "talend_job_validate_audit_columns",        // → talend_validation_validate_audit_columns
  "talend_job_validate_performance_settings", // → talend_validation_validate_performance
  "talend_job_validate_pipeline_spec",        // → talend_jobs_validate_pipeline_spec
  "talend_job_apply_pipeline_spec",           // → talend_jobs_apply_pipeline_spec
  "talend_job_preview_pipeline_spec",         // → talend_jobs_preview_pipeline_spec
  "talend_report_snippet_get",                // → talend_report_snippets_list
  "talend_report_snippet_list",               // → talend_report_snippets_list
  "talend_report_generate_snippets",          // → talend_report_snippets_generate
  "talend_runs_list",                         // → talend_list_runs
  "talend_runs_read",                         // → talend_read_run
  "talend_runs_start",                        // → talend_job_run_by_name
  "talend_runs_start_exported",               // → talend_run_exported_job
  "talend_run_job",                           // → talend_job_run_by_name
  "talend_create_job",                        // → talend_jobs_create
  "talend_list_jobs",                         // → talend_jobs_list
  "talend_read_job",                          // → talend_jobs_read
  "talend_diagnose_job",                      // older name for talend_diagnose_environment
]);

const KNOWN_PRESETS = new Set([
  "all", "canonical", "core", "apps", "jobs", "snapshots", "runs", "errors",
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
  const wantsApps         = patterns.includes("apps");
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

    // "all": every talend_* tool (drops non-prefixed legacy aliases like "repo_pull")
    if (wantsAll && name.startsWith("talend_")) return true;

    // "canonical": every talend_* tool that isn't a known legacy duplicate
    if (wantsCanonical && name.startsWith("talend_") && !LEGACY_TALEND_ALIASES.has(name)) return true;

    // "core": curated 21-tool safe set
    if (wantsCore && PRESET_CORE.has(name)) return true;

    // Module presets by prefix
    if (wantsApps         && name.startsWith("talend_app_")) return true;
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
      name === "talend_list_runs"     || name === "talend_read_run"         ||
      name === "talend_tail_run_output" || name === "talend_read_run_log"   ||
      name === "talend_job_run_by_name" || name === "talend_job_wait_run"   ||
      name === "talend_run_exported_job"
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

export function getLegacyAliases(): Map<string, string> {
  buildRuntimeToolCache();
  return aliasCache!;
}
