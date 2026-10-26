import type { JobSpec } from "../../jobs/job-spec-types";
import { DEFAULT_RULES } from "./default-rules";
import type { ValidationContext, ValidationIssue, ValidationReport, ValidationRule } from "./types";

/** Evalua todas las reglas y separa errores de advertencias. */
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
