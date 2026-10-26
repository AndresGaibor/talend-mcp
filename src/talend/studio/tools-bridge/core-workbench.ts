/** Tools de bridgeTools: core-workbench. */
import * as z from "zod/v4";

import { bridgeOk, bridgeFail, loadBridge, bridgeResultToEnvelope } from "../tools-base";

import { createPlatformContext } from "../../../platform";

import { toTalendHostPath } from "../../../platform/path-bridge";

import { getJobInspector, type ActiveJobConnection } from "../job-inspector.service";

import { bridgeEventTools } from "../tools-bridge-events";

import { bridgeInspectionTools } from "../tools-bridge-inspection";


import { bridgeEditorTools } from "../tools-bridge-editors";
export const coreWorkbench = [
{
    name: "talend_bridge_views",
    description: "Lista las vistas abiertas en el workbench.",
    inputSchema: z.object({}),
    handler: async () => {
      const bridge = await loadBridge();
      const result = await bridge.views();
      return bridgeOk(bridgeResultToEnvelope(result, "/workbench/views"));
    },
  },
{
    name: "talend_bridge_open_resource",
    description: "Abre un recurso en el workbench.",
    inputSchema: z.object({
      path: z.string().describe("Ruta del recurso a abrir"),
    }),
    handler: async ({ path }: { path: string }) => {
      const bridge = await loadBridge();
      const ctx = createPlatformContext();
      const studioPath = toTalendHostPath(path, ctx);
      const result = await bridge.openResource(studioPath);
      return bridgeOk(bridgeResultToEnvelope(result, "/workbench/open-resource"));
    },
  },
{
    name: "talend_bridge_execute_command",
    description: "Ejecuta un comando en el bridge.",
    inputSchema: z.object({
      commandId: z.string().describe("ID del comando a ejecutar"),
      dryRun: z.boolean().optional().default(true).describe("Si es dry run"),
    }),
    handler: async ({ commandId, dryRun }: { commandId: string; dryRun?: boolean }) => {
      const bridge = await loadBridge();
      const result = await bridge.executeCommand(commandId, dryRun ?? true);
      return bridgeOk(bridgeResultToEnvelope(result, "/commands/execute"));
    },
  },
{
    name: "talend_bridge_run_launch_config",
    description: "Ejecuta una configuraciÃ³n de launch.",
    inputSchema: z.object({
      name: z.string().describe("Nombre de la launch config"),
      mode: z.string().optional().default("run").describe("Modo de ejecuciÃ³n"),
      dryRun: z.boolean().optional().default(true).describe("Si es dry run"),
    }),
    handler: async ({ name, mode, dryRun }: { name: string; mode?: string; dryRun?: boolean }) => {
      const bridge = await loadBridge();
      const result = await bridge.runLaunchConfig(name, dryRun ?? true, mode);
      return bridgeOk(bridgeResultToEnvelope(result, "/launch/run"));
    },
  },
{
    name: "talend_bridge_workspace_state",
    description: "Obtiene el estado del workspace.",
    inputSchema: z.object({}),
    handler: async () => {
      const bridge = await loadBridge();
      const result = await bridge.workspaceState();
      return bridgeOk(bridgeResultToEnvelope(result, "/workspace/state"));
    },
  },
{
    name: "talend_bridge_problems_markers",
    description: "Obtiene los markers de problemas.",
    inputSchema: z.object({}),
    handler: async () => {
      const bridge = await loadBridge();
      const result = await bridge.problemsMarkers();
      return bridgeOk(bridgeResultToEnvelope(result, "/problems/markers"));
    },
  },
{
    name: "talend_bridge_probe_classes",
    description: "Probe de clases de Talend.",
    inputSchema: z.object({}),
    handler: async () => {
      const bridge = await loadBridge();
      const result = await bridge.probeClasses();
      return bridgeOk(bridgeResultToEnvelope(result, "/talend/probe/classes"));
    },
  },
{
    name: "talend_bridge_active_editor_introspect",
    description: "Introspecciona el editor activo.",
    inputSchema: z.object({}),
    handler: async () => {
      const bridge = await loadBridge();
      const result = await bridge.activeEditorIntrospect();
      return bridgeOk(bridgeResultToEnvelope(result, "/talend/active-editor/introspect"));
    },
  }
];
