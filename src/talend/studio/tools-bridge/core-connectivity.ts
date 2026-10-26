/** Tools de bridgeTools: core-connectivity. */
import * as z from "zod/v4";

import { bridgeOk, bridgeFail, loadBridge, bridgeResultToEnvelope } from "../tools-base";

import { createPlatformContext } from "../../../platform";

import { toTalendHostPath } from "../../../platform/path-bridge";

import { getJobInspector, type ActiveJobConnection } from "../job-inspector.service";

import { bridgeEventTools } from "../tools-bridge-events";

import { bridgeInspectionTools } from "../tools-bridge-inspection";


import { bridgeEditorTools } from "../tools-bridge-editors";
export const coreConnectivity = [
{
    name: "talend_bridge_ping",
    description: "Verifica si el bridge de Talend Studio estÃ¡ disponible.",
    inputSchema: z.object({}),
    handler: async () => {
      const bridge = await loadBridge();
      const result = await bridge.ping();
      return bridgeOk(bridgeResultToEnvelope(result, "/ping"));
    },
  },
{
    name: "talend_bridge_capabilities",
    description: "Obtiene las capacidades del plugin bridge.",
    inputSchema: z.object({}),
    handler: async () => {
      const bridge = await loadBridge();
      const result = await bridge.capabilities();
      return bridgeOk(bridgeResultToEnvelope(result, "/capabilities"));
    },
  },
{
    name: "talend_bridge_audit_environment",
    description: "Audita el entorno de Talend Studio.",
    inputSchema: z.object({}),
    handler: async () => {
      const bridge = await loadBridge();
      const result = await bridge.auditEnvironment();
      return bridgeOk(bridgeResultToEnvelope(result, "/audit/environment"));
    },
  },
{
    name: "talend_bridge_workbench_state",
    description: "Obtiene el estado actual del workbench.",
    inputSchema: z.object({}),
    handler: async () => {
      const bridge = await loadBridge();
      const result = await bridge.workbenchState();
      return bridgeOk(bridgeResultToEnvelope(result, "/workbench/state"));
    },
  },
{
    name: "talend_bridge_active_job_model",
    description: "Obtiene el modelo del job activo en Studio.",
    inputSchema: z.object({}),
    handler: async () => {
      const bridge = await loadBridge();
      const result = await bridge.activeJobModel();
      return bridgeOk(bridgeResultToEnvelope(result, "/talend/active-job/model"));
    },
  },
{
    name: "talend_bridge_commands",
    description: "Lista los comandos disponibles en el bridge.",
    inputSchema: z.object({}),
    handler: async () => {
      const bridge = await loadBridge();
      const result = await bridge.commandsList();
      return bridgeOk(bridgeResultToEnvelope(result, "/commands/list"));
    },
  },
{
    name: "talend_bridge_launch_configs",
    description: "Lista las configuraciones de launch disponibles.",
    inputSchema: z.object({}),
    handler: async () => {
      const bridge = await loadBridge();
      const result = await bridge.launchConfigs();
      return bridgeOk(bridgeResultToEnvelope(result, "/launch/configs"));
    },
  },
{
    name: "talend_bridge_selection",
    description: "Obtiene la selecciÃ³n actual en el workbench.",
    inputSchema: z.object({}),
    handler: async () => {
      const bridge = await loadBridge();
      const result = await bridge.selection();
      return bridgeOk(bridgeResultToEnvelope(result, "/workbench/selection"));
    },
  }
];
