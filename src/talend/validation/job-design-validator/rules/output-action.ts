import type { ValidationRule } from "../types";

/** Regla de compatibilidad del modo de escritura con el patron. */
export const outputActionRule: ValidationRule = {
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
};
