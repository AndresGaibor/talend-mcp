import { COMPONENT_REGISTRY } from "../../../component-registry";
import { getCatalog } from "../catalog";
import type { ValidationRule } from "../types";

/**
 * Verifica que cada componente tenga los parametros obligatorios.
 *
 * La fuente de verdad es `COMPONENT_REGISTRY` y, si el componente no esta en
 * el registro, el catalogo generado. Si no aparece en ninguno, no se valida.
 */
export const componentParametersRule: ValidationRule = {
  id: "component-parameters",
  description: "Verifica que todos los componentes del job tengan sus parámetros obligatorios según el registro",
  check: (spec) => {
    const catalog = getCatalog();
    const catalogEntries = catalog?.entries || [];

    for (const comp of spec.components || []) {
      let requiredParams: string[] = [];
      const def = COMPONENT_REGISTRY[comp.componentName];
      if (def) {
        requiredParams = def.requiredParameters;
      } else {
        const catEntry = catalogEntries.find((e: any) => e.componentName === comp.componentName);
        if (catEntry) {
          requiredParams = catEntry.parameters
            .filter((p: any) => p.required)
            .map((p: any) => p.name);
        } else {
          continue;
        }
      }

      for (const reqParam of requiredParams) {
        const value = comp.parameters[reqParam];
        if (value === undefined || value === null || String(value).trim() === "") {
          return {
            ruleId: "component-parameters",
            severity: "error",
            message: `El componente '${comp.name}' (${comp.componentName}) requiere el parámetro '${reqParam}'`,
            fix: `Agregar el parámetro '${reqParam}' en la configuración del componente.`,
          };
        }
      }
    }
    return null;
  },
};
