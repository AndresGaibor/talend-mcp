import type { ComponentDefinition } from "../../domain/component-definition.types";

/**
 * Conector por el que se entra al componente.
 *
 * Casi todos usan el principal ("FLOW"), pero hay excepciones: el
 * `tAggregateRow`, por ejemplo, no tiene conector FLOW de entrada.
 */
export function inputConnectorOf(definition: ComponentDefinition): string {
  const candidatos = definition.connectors.filter(
    (connector) => (connector.maxInput ?? 0) >= 1 && !isTrigger(connector.name),
  );
  return candidatos.find((connector) => connector.name === "FLOW")?.name ?? candidatos[0]?.name ?? "FLOW";
}

/**
 * Conector por el que sale el componente.
 *
 * Aqui esta la trampa: el `tUniqRow` no saca sus filas por el conector
 * principal, sino por "UNIQUE" (y "DUPLICATE" para las repetidas). Conectar
 * por "FLOW" no da error: el job compila y no sale ninguna fila.
 */
export function outputConnectorOf(definition: ComponentDefinition): string {
  const candidatos = definition.connectors.filter(
    (connector) =>
      (connector.maxOutput ?? 0) >= 1 &&
      connector.name !== "ITERATE" &&
      !isTrigger(connector.name),
  );
  return candidatos.find((connector) => connector.name === "FLOW")?.name ?? candidatos[0]?.name ?? "FLOW";
}

/** Los triggers no son conectores de datos. */
function isTrigger(name: string): boolean {
  return ["SUBJOB_OK", "SUBJOB_ERROR", "COMPONENT_OK", "COMPONENT_ERROR", "RUN_IF"].includes(name);
}
