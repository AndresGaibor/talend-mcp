import { bridgeTools } from "./tools-bridge";
import { syncTools } from "./tools-sync";
import { componentTools } from "./tools-components";
import { masteryTools } from "./tools-mastery";
import { snapshotTools } from "./tools-snapshot";
import { errorTools } from "./tools-errors";
import { automationTools } from "./tools-automation";
import type { BridgeToolDef } from "./tools-base";

export const allTools: BridgeToolDef[] = [
  ...bridgeTools,
  ...syncTools,
  ...componentTools,
  ...masteryTools,
  ...snapshotTools,
  ...errorTools,
  ...automationTools,
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
export type { BridgeToolDef, ToolEnvelope } from "./tools-base";
export { bridgeOk, bridgeFail, loadBridge } from "./tools-base";