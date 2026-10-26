import type { JobSpec } from "../../jobs/job-spec-types";

/** Contratos del validador de diseno de jobs. */

export interface ValidationRule {
  id: string;
  description: string;
  check: (spec: JobSpec, context: ValidationContext) => ValidationIssue | null;
}

export interface ValidationContext {
  requiredInputCount?: number;
  requiredOutputCount?: number;
  requiredContexts?: string[];
  forbidBusinessTransformsInTalend?: boolean;
  requiredAuditColumns?: boolean;
  maxBatchSize?: number;
  minBatchSize?: number;
  outputAction?: "append" | "truncate" | "upsert";
  allowedComponentFamilies?: string[];
  forbiddenComponentFamilies?: string[];
}

export interface ValidationIssue {
  ruleId: string;
  severity: "error" | "warning";
  message: string;
  field?: string;
  fix?: string;
}

export interface ValidationReport {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  summary: {
    totalRulesChecked: number;
    rulesPassed: number;
    rulesFailed: number;
  };
}
