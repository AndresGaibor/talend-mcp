import type { ValidationRule } from "./types";
import { auditColumnsRule } from "./rules/audit-columns";
import { batchSizeRangeRule } from "./rules/batch-size-range";
import { componentParametersRule } from "./rules/component-parameters";
import { outputActionRule } from "./rules/output-action";
import { hasComponentsRule, jobNameFormatRule } from "./rules/spec-structure";

/**
 * Reglas que se aplican siempre, en este orden.
 *
 * El orden importa: el informe lista los hallazgos en el orden de evaluacion.
 */
export const DEFAULT_RULES: ValidationRule[] = [
  auditColumnsRule,
  batchSizeRangeRule,
  outputActionRule,
  jobNameFormatRule,
  hasComponentsRule,
  componentParametersRule,
];
