import type { ValidationRule } from "../types";

/** Reglas sobre la forma del spec: nombre del job y presencia de componentes. */

export const jobNameFormatRule: ValidationRule = {
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
};

export const hasComponentsRule: ValidationRule = {
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
};
