import type { JobSpec } from "../jobs/job-spec-types";

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

const DEFAULT_RULES: ValidationRule[] = [
  {
    id: "audit-columns",
    description: "Verifica que columnas técnicas de audit estén presentes si el patrón las soporta",
    check: (spec) => {
      if (spec.auditColumns && (!spec.technicalColumns || spec.technicalColumns.length === 0)) {
        return {
          ruleId: "audit-columns",
          severity: "error",
          message: "auditColumns=true requiere que se definan technicalColumns (_load_ts, _load_run)",
          fix: "Agregar technicalColumns al spec o desactivar auditColumns",
        };
      }
      return null;
    },
  },
  {
    id: "batch-size-range",
    description: "Verifica que el batch size esté en rango razonable",
    check: (spec, ctx) => {
      if (spec.batchSize === undefined) return null;
      if (ctx.minBatchSize && spec.batchSize < ctx.minBatchSize) {
        return {
          ruleId: "batch-size-range",
          severity: "error",
          message: `batchSize ${spec.batchSize} es menor al mínimo ${ctx.minBatchSize}`,
        };
      }
      if (ctx.maxBatchSize && spec.batchSize > ctx.maxBatchSize) {
        return {
          ruleId: "batch-size-range",
          severity: "warning",
          message: `batchSize ${spec.batchSize} excede máximo recomendado ${ctx.maxBatchSize}`,
        };
      }
      return null;
    },
  },
  {
    id: "output-action",
    description: "Verifica que el output action sea compatible con el patrón",
    check: (spec, ctx) => {
      if (ctx.outputAction === "append" && spec.appendMode === false) {
        return {
          ruleId: "output-action",
          severity: "warning",
          message: "Se recomienda append=true para jobs de carga raw",
        };
      }
      return null;
    },
  },
  {
    id: "job-name-format",
    description: "Verifica formato del nombre del job",
    check: (spec) => {
      if (!spec.jobName || spec.jobName.trim() === "") {
        return {
          ruleId: "job-name-format",
          severity: "error",
          message: "El nombre del job no puede estar vacío",
        };
      }
      if (!/^[A-Z]/.test(spec.jobName)) {
        return {
          ruleId: "job-name-format",
          severity: "warning",
          message: "El nombre del job debería empezar con mayúscula (convención Talend)",
        };
      }
      if (spec.jobName.includes(" ")) {
        return {
          ruleId: "job-name-format",
          severity: "warning",
          message: "El nombre del job no debería contener espacios",
        };
      }
      return null;
    },
  },
  {
    id: "has-components",
    description: "Verifica que el job tenga al menos un componente",
    check: (spec) => {
      if (!spec.components || spec.components.length === 0) {
        return {
          ruleId: "has-components",
          severity: "error",
          message: "El job debe tener al menos un componente",
        };
      }
      return null;
    },
  },
];

export function validateJobDesign(
  spec: JobSpec,
  context: ValidationContext = {},
  additionalRules: ValidationRule[] = []
): ValidationReport {
  const rules = [...DEFAULT_RULES, ...additionalRules];
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  for (const rule of rules) {
    const issue = rule.check(spec, context);
    if (issue) {
      if (issue.severity === "error") {
        errors.push(issue);
      } else {
        warnings.push(issue);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    summary: {
      totalRulesChecked: rules.length,
      rulesPassed: rules.length - errors.length - warnings.length,
      rulesFailed: errors.length + warnings.length,
    },
  };
}

export const DEFAULT_VALIDATION_CONTEXT: ValidationContext = {
  requiredInputCount: 1,
  requiredOutputCount: 1,
  requiredContexts: ["input_path", "batch_size", "run_id"],
  forbidBusinessTransformsInTalend: true,
  requiredAuditColumns: true,
  minBatchSize: 100,
  maxBatchSize: 20000,
  outputAction: "append",
};
