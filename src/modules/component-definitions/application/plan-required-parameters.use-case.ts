/**
 * Fachada del plan de relleno de los parámetros obligatorios de un componente.
 *
 * El cálculo vive en `plan-required-parameters/`: los tipos, la evaluación de
 * condiciones de visibilidad, el plan de parámetros, los conectores de entrada
 * y salida y el plan de montaje.
 */

export { evaluateCondition } from "./plan-required-parameters/condition";
export { planRequiredParameters } from "./plan-required-parameters/parameter-plan";
export { inputConnectorOf, outputConnectorOf } from "./plan-required-parameters/connectors";
export { planMount } from "./plan-required-parameters/mount-plan";
export type {
  MountPlan,
  PlannedParameter,
  RequiredParametersPlan,
  SkippedParameter,
} from "./plan-required-parameters/types";
