import type { ValidationRule } from "../types";

/** Regla de rango del tamano de lote. */
export const batchSizeRangeRule: ValidationRule = {
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
};
