import type { ValidationContext } from "./types";

/** Contexto por defecto para jobs de carga raw. */
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
