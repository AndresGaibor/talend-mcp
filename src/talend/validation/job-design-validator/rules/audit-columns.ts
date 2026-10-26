import type { ValidationRule } from "../types";

/** Regla de columnas tecnicas de auditoria. */
export const auditColumnsRule: ValidationRule = {
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
};
