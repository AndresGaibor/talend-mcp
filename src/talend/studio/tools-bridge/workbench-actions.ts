/** Tools de bridgeTools: workbench-actions. */
import * as z from "zod/v4";

import { bridgeOk, bridgeFail, loadBridge, bridgeResultToEnvelope } from "../tools-base";

import { createPlatformContext } from "../../../platform";

import { toTalendHostPath } from "../../../platform/path-bridge";

import { getJobInspector, type ActiveJobConnection } from "../job-inspector.service";

import { bridgeEventTools } from "../tools-bridge-events";

import { bridgeInspectionTools } from "../tools-bridge-inspection";


import { bridgeEditorTools } from "../tools-bridge-editors";
export const workbenchActions = [
{
    name: "talend_bridge_save_active_editor",
    description: "Guarda el editor activo.",
    inputSchema: z.object({}),
    handler: async () => {
      const bridge = await loadBridge();
      const result = await bridge.saveActiveEditor();
      return bridgeOk(bridgeResultToEnvelope(result, "/workbench/save-active"));
    },
  },
{
    name: "talend_bridge_save_all",
    description: "Guarda todos los editores.",
    inputSchema: z.object({}),
    handler: async () => {
      const bridge = await loadBridge();
      const result = await bridge.saveAllEditors();
      return bridgeOk(bridgeResultToEnvelope(result, "/workbench/save-all"));
    },
  },
{
    name: "talend_bridge_refresh_workspace",
    description: "Refresca el workspace.",
    inputSchema: z.object({}),
    handler: async () => {
      const bridge = await loadBridge();
      const result = await bridge.refreshWorkspace();
      return bridgeOk(bridgeResultToEnvelope(result, "/workspace/refresh"));
    },
  }
];
