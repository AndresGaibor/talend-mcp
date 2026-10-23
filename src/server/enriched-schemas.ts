import { z } from "zod/v4";
import { jobsAndComponentsSchemas } from "./enriched/jobs-components.schemas";
import { executionStudioSchemas } from "./enriched/execution-studio.schemas";
import { contextsRepositorySchemas } from "./enriched/contexts-repository.schemas";
import { analysisSchemas } from "./enriched/analysis.schemas";
import { moduleSchemas } from "./enriched/modules.schemas";

export {
  DQIndicatorSchema,
  DqAnalysisSchema,
  ExportedJobScriptSchema,
  MapperEntrySchema,
  ParsedJobSchema,
  RepositoryContextSchema,
  RunHistoryEntrySchema,
  SchemaIssueSchema,
  TalendColumnSchema,
  TalendComponentSchema,
  TalendConnectionSchema,
  TalendContextParameterSchema,
  TalendSchemaSchema,
} from "./enriched/base-schemas";

// ─── Enriched Tool Data Schema Mapping ────────────────────────────────────────

const ENRICHED_DATA_SCHEMAS: Record<string, z.ZodTypeAny | undefined> = {
  ...executionStudioSchemas,
  ...analysisSchemas,

  ...jobsAndComponentsSchemas,

  ...contextsRepositorySchemas,

  ...moduleSchemas,
};

// ─── Alias Assignments ───
ENRICHED_DATA_SCHEMAS.talend_jobs_list = ENRICHED_DATA_SCHEMAS.talend_list_jobs;
ENRICHED_DATA_SCHEMAS.talend_jobs_read = ENRICHED_DATA_SCHEMAS.talend_read_job;
ENRICHED_DATA_SCHEMAS.talend_runs_list = ENRICHED_DATA_SCHEMAS.talend_list_runs;
ENRICHED_DATA_SCHEMAS.talend_runs_read = ENRICHED_DATA_SCHEMAS.talend_read_run;
ENRICHED_DATA_SCHEMAS.talend_runs_start = ENRICHED_DATA_SCHEMAS.talend_run_job;
ENRICHED_DATA_SCHEMAS.talend_runs_start_exported = ENRICHED_DATA_SCHEMAS.talend_run_exported_job;
ENRICHED_DATA_SCHEMAS.talend_job_run_by_name = ENRICHED_DATA_SCHEMAS.talend_run_job;
ENRICHED_DATA_SCHEMAS.talend_diagnose_job = ENRICHED_DATA_SCHEMAS.talend_diagnose_environment;
ENRICHED_DATA_SCHEMAS.talend_secret_scan_project = ENRICHED_DATA_SCHEMAS.talend_secrets_scan_project;
ENRICHED_DATA_SCHEMAS.talend_secret_scan_job = ENRICHED_DATA_SCHEMAS.talend_secrets_scan_job;
ENRICHED_DATA_SCHEMAS.talend_secret_suggest_context_migration = ENRICHED_DATA_SCHEMAS.talend_secrets_suggest_context_migration;
ENRICHED_DATA_SCHEMAS.talend_snapshot_list = ENRICHED_DATA_SCHEMAS.talend_snapshots_list;
ENRICHED_DATA_SCHEMAS.talend_snapshot_create = ENRICHED_DATA_SCHEMAS.talend_snapshots_create;
ENRICHED_DATA_SCHEMAS.talend_snapshot_diff = ENRICHED_DATA_SCHEMAS.talend_snapshots_diff;
ENRICHED_DATA_SCHEMAS.talend_snapshot_restore = ENRICHED_DATA_SCHEMAS.talend_snapshots_restore;
ENRICHED_DATA_SCHEMAS.talend_snapshot_read = ENRICHED_DATA_SCHEMAS.talend_snapshots_read;
ENRICHED_DATA_SCHEMAS.talend_deliverable_export_job = ENRICHED_DATA_SCHEMAS.talend_deliverables_export_job;
ENRICHED_DATA_SCHEMAS.talend_deliverable_collect_files = ENRICHED_DATA_SCHEMAS.talend_deliverables_collect;
ENRICHED_DATA_SCHEMAS.talend_deliverable_create_package = ENRICHED_DATA_SCHEMAS.talend_deliverables_create_package;
ENRICHED_DATA_SCHEMAS.talend_deliverables_validate = ENRICHED_DATA_SCHEMAS.talend_deliverables_validate;
ENRICHED_DATA_SCHEMAS.talend_deliverable_validate_checklist = ENRICHED_DATA_SCHEMAS.talend_deliverables_validate;
ENRICHED_DATA_SCHEMAS.talend_dataset_inspect_csv_folder = ENRICHED_DATA_SCHEMAS.talend_datasets_inspect_csv_folder;
ENRICHED_DATA_SCHEMAS.talend_dataset_infer_csv_schema = ENRICHED_DATA_SCHEMAS.talend_datasets_infer_csv_schema;
ENRICHED_DATA_SCHEMAS.talend_dataset_generate_raw_table_mapping = ENRICHED_DATA_SCHEMAS.talend_datasets_generate_raw_mappings;
ENRICHED_DATA_SCHEMAS.talend_dataset_generate_raw_table_mappings = ENRICHED_DATA_SCHEMAS.talend_datasets_generate_raw_mappings;
ENRICHED_DATA_SCHEMAS.talend_error_explain = ENRICHED_DATA_SCHEMAS.talend_errors_explain;
ENRICHED_DATA_SCHEMAS.talend_error_suggest_fix = ENRICHED_DATA_SCHEMAS.talend_errors_suggest_fix;
ENRICHED_DATA_SCHEMAS.talend_error_stats = ENRICHED_DATA_SCHEMAS.talend_errors_stats;
ENRICHED_DATA_SCHEMAS.talend_job_validate_design = ENRICHED_DATA_SCHEMAS.talend_validation_validate_design;
ENRICHED_DATA_SCHEMAS.talend_job_validate_context_usage = ENRICHED_DATA_SCHEMAS.talend_validation_validate_context_usage;
ENRICHED_DATA_SCHEMAS.talend_job_validate_audit_columns = ENRICHED_DATA_SCHEMAS.talend_validation_validate_audit_columns;
ENRICHED_DATA_SCHEMAS.talend_job_validate_performance_settings = ENRICHED_DATA_SCHEMAS.talend_validation_validate_performance;
ENRICHED_DATA_SCHEMAS.talend_job_validate_pipeline_spec = ENRICHED_DATA_SCHEMAS.talend_jobs_validate_pipeline_spec;
ENRICHED_DATA_SCHEMAS.talend_job_apply_pipeline_spec = ENRICHED_DATA_SCHEMAS.talend_jobs_apply_pipeline_spec;
ENRICHED_DATA_SCHEMAS.talend_job_preview_pipeline_spec = ENRICHED_DATA_SCHEMAS.talend_jobs_preview_pipeline_spec;
ENRICHED_DATA_SCHEMAS.talend_report_snippet_get = ENRICHED_DATA_SCHEMAS.talend_report_snippets_list;
ENRICHED_DATA_SCHEMAS.talend_report_snippet_list = ENRICHED_DATA_SCHEMAS.talend_report_snippets_list;
ENRICHED_DATA_SCHEMAS.talend_report_generate_snippets = ENRICHED_DATA_SCHEMAS.talend_report_snippets_generate;


// ─── Helper Functions to construct output envelopes ──────────────────────────

/**
 * Checks if the tool has an enriched data schema registered.
 */
export function hasEnrichedDataSchema(toolName: string): boolean {
  const normName = toolName.startsWith("talend_") ? toolName : `talend_${toolName}`;
  return normName in ENRICHED_DATA_SCHEMAS;
}

/**
 * Gets the Zod output schema for the tool.
 * Depending on the result pattern, we wrap it in TalendResult or standard Pattern A.
 */
export function getEnrichedOutputSchema(toolName: string, pattern: "A" | "B" = "A"): z.ZodTypeAny {
  const normName = toolName.startsWith("talend_") ? toolName : `talend_${toolName}`;
  const dataSchema = ENRICHED_DATA_SCHEMAS[normName] ?? z.unknown();

  if (pattern === "B" || normName === "talend_diagnose_environment") {
    // Return the full TalendResult wrapper
    return z.object({
      ok: z.boolean().describe("Whether the operation succeeded"),
      source: z.string().describe("Tool name that produced this result"),
      confidence: z.enum(["high", "medium", "low", "none"]).describe("Confidence level of the result"),
      data: dataSchema.optional().describe("The result payload"),
      warnings: z.array(z.string()).optional().describe("Non-fatal warnings"),
      errors: z.array(
        z.object({
          code: z.string(),
          message: z.string(),
          details: z.record(z.string(), z.unknown()).optional(),
        })
      ).optional().describe("Errors if ok is false"),
      nextActions: z.array(
        z.object({
          label: z.string(),
          toolName: z.string(),
          input: z.record(z.string(), z.unknown()).optional(),
        })
      ).optional().describe("Suggested follow-up tool calls"),
    });
  }

  // Return the standard ok/fail envelope (Pattern A).
  // Las tools devuelven el envelope TalendResult (okResult/errorResult) o el
  // envelope corto (ok/fail); el schema publicado debe aceptar ambos, o los
  // clientes MCP con validacion estricta rechazan toda respuesta.
  return z.object({
    ok: z.boolean().describe("Whether the operation succeeded"),
    source: z.string().optional().describe("Tool name that produced this result"),
    confidence: z.enum(["high", "medium", "low", "none"]).optional().describe("Confidence level of the result"),
    data: dataSchema.optional().describe("The result payload"),
    durationMs: z.number().optional().describe("Operation duration in milliseconds"),
    warnings: z.array(z.string()).optional().describe("Non-fatal warnings"),
    errors: z.array(
      z.object({
        code: z.string(),
        message: z.string(),
        details: z.record(z.string(), z.unknown()).optional(),
      })
    ).optional().describe("Errors if ok is false"),
    nextActions: z.array(
      z.object({
        label: z.string(),
        toolName: z.string(),
        input: z.record(z.string(), z.unknown()).optional(),
      })
    ).optional().describe("Suggested follow-up tool calls"),
    error: z.object({
      code: z.string(),
      message: z.string(),
      details: z.record(z.string(), z.unknown()).optional(),
    }).optional().describe("Error payload if operation failed"),
  });
}
