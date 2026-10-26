/**
 * Fachada del validador de diseno de jobs.
 *
 * El orquestador vive en `job-design-validator/validate.ts`, las reglas por
 * archivo en `job-design-validator/rules/`, el orden de evaluacion en
 * `job-design-validator/default-rules.ts` y el contexto por defecto en
 * `job-design-validator/default-context.ts`.
 */

export type {
  ValidationContext,
  ValidationIssue,
  ValidationReport,
  ValidationRule,
} from "./job-design-validator/types";
export { validateJobDesign } from "./job-design-validator/validate";
export { DEFAULT_VALIDATION_CONTEXT } from "./job-design-validator/default-context";
