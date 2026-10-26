import type { ComponentDefinition } from "../../domain/component-definition.types";
import { decideValue, isVisible, needsRealValue } from "./value-decision";
import type {
  PlannedParameter,
  RequiredParametersPlan,
  SkippedParameter,
} from "./types";

/**
 * Calcula el plan de parámetros obligatorios de un componente.
 */
export function planRequiredParameters(definition: ComponentDefinition): RequiredParametersPlan {
  const parameters: PlannedParameter[] = [];
  const skipped: SkippedParameter[] = [];

  // Los valores conocidos: los que el propio XML declara por defecto. Sirven
  // para decidir qué parámetros están visibles (SHOW_IF).
  const values: Record<string, string | undefined> = {};
  for (const parameter of definition.parameters) {
    if (parameter.defaultValue !== undefined) values[parameter.name] = parameter.defaultValue;
  }

  for (const parameter of definition.requiredParameters) {
    if (!parameter.show) {
      skipped.push({
        name: parameter.name,
        field: parameter.field,
        reason: "el parametro esta oculto en el formulario (SHOW=false)",
      });
      continue;
    }
    if (!isVisible(parameter, values)) {
      skipped.push({
        name: parameter.name,
        field: parameter.field,
        reason: "no se ve con los valores actuales (SHOW_IF/NOT_SHOW_IF)",
      });
      continue;
    }
    if (needsRealValue(parameter.field)) {
      // Una tabla si se puede: el XML declara sus columnas y sus valores por
      // defecto, y las filas se hacen con las columnas del schema.
      if (parameter.field.toUpperCase().includes("TABLE") && parameter.table) {
        parameters.push({
          name: parameter.name,
          field: parameter.field,
          kind: "table",
          table: parameter.table,
        });
        continue;
      }
      skipped.push({
        name: parameter.name,
        field: parameter.field,
        reason: `hace falta un valor real de tipo ${parameter.field}`,
      });
      continue;
    }
    const decided = decideValue(parameter, definition.name);
    if (!decided) {
      skipped.push({
        name: parameter.name,
        field: parameter.field,
        reason: "no se puede inventar un valor para este tipo de parametro",
      });
      continue;
    }
    parameters.push({
      name: parameter.name,
      field: parameter.field,
      kind: "value",
      value: decided.value,
      literal: decided.literal,
      source: decided.source,
    });
    values[parameter.name] = decided.value;
  }

  return { component: definition.name, parameters, skipped };
}
