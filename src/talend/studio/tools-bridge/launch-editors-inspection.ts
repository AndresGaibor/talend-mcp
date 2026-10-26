/** Tools de bridgeTools: launch-editors-inspection. */
import * as z from "zod/v4";

import { bridgeOk, bridgeFail, loadBridge, bridgeResultToEnvelope } from "../tools-base";

import { createPlatformContext } from "../../../platform";

import { toTalendHostPath } from "../../../platform/path-bridge";

import { getJobInspector, type ActiveJobConnection } from "../job-inspector.service";

import { bridgeEventTools } from "../tools-bridge-events";

import { bridgeInspectionTools } from "../tools-bridge-inspection";

import { bridgeLaunchRunTools } from "../tools-bridge-launch-runs";

import { bridgeEditorTools } from "../tools-bridge-editors";
export const launchEditorsInspection = [
...bridgeLaunchRunTools,
...bridgeEditorTools,
...bridgeInspectionTools
];
