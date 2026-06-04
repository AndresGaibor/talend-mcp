import { bridgeTools } from "./tools-bridge";
import { syncTools } from "./tools-sync";
import { componentTools } from "./tools-components";
import { masteryTools } from "./tools-mastery";
import { snapshotTools } from "./tools-snapshot";
import { errorTools } from "./tools-errors";
import { automationTools } from "./tools-automation";
import { coverageTools } from "./tools-coverage";
import { taskTools } from "./tools-task";
import { datasetTools } from "./tools-datasets";
import { contextTools } from "./tools-context-profile";
import { connectionTools } from "./tools-connections";
import { jobSpecTools } from "./tools-job-spec";
import { validationTools } from "./tools-validation";
import { executionTools } from "./tools-execution";
import { deliverableTools } from "./tools-deliverables";
import type { BridgeToolDef } from "./tools-base";

export const allTools: BridgeToolDef[] = [
  ...bridgeTools,
  ...syncTools,
  ...componentTools,
  ...masteryTools,
  ...snapshotTools,
  ...errorTools,
  ...automationTools,
  ...coverageTools,
  ...taskTools,
  ...datasetTools,
  ...contextTools,
  ...connectionTools,
  ...jobSpecTools,
  ...validationTools,
  ...executionTools,
  ...deliverableTools,
];

export function createStudioBridgeTools(): BridgeToolDef[] {
  return allTools;
}

export { bridgeTools } from "./tools-bridge";
export { syncTools } from "./tools-sync";
export { componentTools } from "./tools-components";
export { masteryTools } from "./tools-mastery";
export { snapshotTools } from "./tools-snapshot";
export { errorTools } from "./tools-errors";
export { automationTools } from "./tools-automation";
export { coverageTools } from "./tools-coverage";
export { taskTools } from "./tools-task";
export { datasetTools } from "./tools-datasets";
export { contextTools } from "./tools-context-profile";
export { connectionTools } from "./tools-connections";
export { jobSpecTools } from "./tools-job-spec";
export { validationTools } from "./tools-validation";
export { executionTools } from "./tools-execution";
export { deliverableTools } from "./tools-deliverables";
export type { BridgeToolDef, ToolEnvelope } from "./tools-base";
export { bridgeOk, bridgeFail, loadBridge } from "./tools-base";