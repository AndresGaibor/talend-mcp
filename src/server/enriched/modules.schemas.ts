import { z } from "zod/v4";

export const moduleSchemas: Record<string, z.ZodTypeAny> = {
  talend_secrets_scan_project: z.object({
    filesScannedCount: z.number().describe("Number of files scanned"),
    secretsFoundCount: z.number().describe("Number of secrets found"),
    findings: z.array(z.object({
      filePath: z.string(),
      jobName: z.string(),
      componentName: z.string().optional(),
      parameterName: z.string().optional(),
      secretValue: z.string(),
      type: z.string().optional(),
    })),
  }),
  talend_secrets_scan_job: z.object({
    jobName: z.string(),
    secretsFoundCount: z.number(),
    findings: z.array(z.object({
      componentName: z.string().optional(),
      parameterName: z.string().optional(),
      secretValue: z.string(),
      type: z.string().optional(),
    })),
  }),
  talend_secrets_suggest_context_migration: z.object({
    jobName: z.string(),
    suggestions: z.array(z.object({
      componentName: z.string(),
      parameterName: z.string(),
      currentValue: z.string(),
      suggestedContextParamName: z.string(),
    })),
  }),
  talend_snapshots_list: z.array(z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().optional(),
    createdAt: z.string(),
    tags: z.array(z.string()).optional(),
  })),
  talend_snapshots_create: z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().optional(),
    createdAt: z.string(),
    tags: z.array(z.string()).optional(),
  }),
  talend_snapshots_diff: z.object({
    changes: z.array(z.object({
      filePath: z.string(),
      changeType: z.enum(["created", "modified", "deleted"]),
    })),
  }),
  talend_snapshots_restore: z.object({ restored: z.boolean(), snapshotId: z.string() }),
  talend_snapshots_read: z.object({ snapshotId: z.string(), files: z.array(z.string()) }),
  talend_datasets_inspect_csv_folder: z.object({
    folderPath: z.string(),
    files: z.array(z.object({
      relativePath: z.string(),
      sizeBytes: z.number(),
      lineCount: z.number().optional(),
    })),
    totalRows: z.number(),
  }),
  talend_datasets_infer_csv_schema: z.object({
    csvFile: z.string(),
    tableName: z.string(),
    columns: z.array(z.object({
      csvColumn: z.string(),
      dbColumn: z.string(),
      dbType: z.string(),
      nullable: z.boolean(),
      sampleValues: z.array(z.string()).optional(),
    })),
  }),
  talend_datasets_generate_raw_mappings: z.object({
    folderPath: z.string(),
    mappings: z.array(z.object({
      csvFile: z.string(),
      targetTable: z.string(),
      columns: z.array(z.object({
        source: z.string(),
        target: z.string(),
        talendType: z.string(),
        nullable: z.boolean(),
      })),
      technicalColumns: z.array(z.object({ name: z.string(), expression: z.string() })),
    })),
    csvFileCount: z.number(),
    totalRows: z.number(),
  }),
  talend_deliverables_export_job: z.object({ exportedZipPath: z.string(), jobName: z.string(), version: z.string() }),
  talend_deliverables_collect: z.object({ collectedFiles: z.array(z.string()), destinationDir: z.string() }),
  talend_deliverables_validate: z.object({
    valid: z.boolean(),
    errors: z.array(z.string()),
    warnings: z.array(z.string()),
  }),
  talend_deliverables_create_package: z.object({ packagePath: z.string(), contents: z.array(z.string()) }),
  talend_errors_explain: z.object({
    explanation: z.string(),
    probableCause: z.string(),
    component: z.string().optional(),
  }),
  talend_errors_suggest_fix: z.object({ suggestions: z.array(z.string()), codeSnippet: z.string().optional() }),
  talend_errors_stats: z.object({ totalErrors: z.number(), errorsByType: z.record(z.string(), z.number()) }),
  talend_validation_validate_design: z.object({
    score: z.number().describe("0-100 design score"),
    issues: z.array(z.object({
      componentName: z.string().optional(),
      severity: z.enum(["low", "medium", "high"]),
      message: z.string(),
    })),
  }),
  talend_validation_validate_context_usage: z.object({
    issues: z.array(z.object({ message: z.string(), severity: z.enum(["low", "medium", "high"]) })),
  }),
  talend_validation_validate_audit_columns: z.object({ compliant: z.boolean(), missingColumns: z.array(z.string()) }),
  talend_validation_validate_performance: z.object({ score: z.number(), recommendations: z.array(z.string()) }),
};
