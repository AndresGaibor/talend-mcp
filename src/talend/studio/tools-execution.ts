/** Fachada de executionTools; conserva el orden publico de registro. */
import { launch } from "./tools-execution/launch";
import { runtime } from "./tools-execution/runtime";
import { runs } from "./tools-execution/runs";
export const executionTools = [...launch, ...runtime, ...runs];
