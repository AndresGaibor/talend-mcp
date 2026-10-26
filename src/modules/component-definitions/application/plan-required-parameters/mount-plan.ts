import type { ComponentDefinition } from "../../domain/component-definition.types";
import { inputConnectorOf, outputConnectorOf } from "./connectors";
import { planRequiredParameters } from "./parameter-plan";
import type { MountPlan } from "./types";

/** Plan de montaje: parámetros, si necesita origen y por dónde entra y sale. */
export function planMount(definition: ComponentDefinition): MountPlan {
  const flow = definition.connectors.filter((connector) => connector.type === "FLOW");
  const plan = planRequiredParameters(definition);
  const parameters: MountPlan["parameters"] = {};
  for (const parameter of plan.parameters) {
    parameters[parameter.name] =
      parameter.kind === "table"
        ? { table: parameter.table }
        : { value: parameter.value, literal: parameter.literal };
  }
  return {
    parameters,
    source: flow.some((connector) => (connector.maxInput ?? 0) >= 1),
    input: inputConnectorOf(definition),
    output: outputConnectorOf(definition),
  };
}
