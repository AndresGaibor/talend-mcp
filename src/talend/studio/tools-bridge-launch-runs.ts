import * as z from "zod/v4";
import { bridgeOk, bridgeResultToEnvelope, loadBridge } from "./tools-base";

export const bridgeLaunchRunTools = [
  {
    name: "talend_bridge_launch_runs",
    description: "Lista las ejecuciones recientes.",
    inputSchema: z.object({}),
    handler: async () => {
      const bridge = await loadBridge();
      const result = await bridge.launchRuns();
      return bridgeOk(bridgeResultToEnvelope(result, "/launch/runs"));
    },
  },
  {
    name: "talend_bridge_launch_status",
    description: "Obtiene el estado de una ejecución.",
    inputSchema: z.object({
      launchId: z.string().describe("ID de la launch"),
    }),
    handler: async ({ launchId }: { launchId: string }) => {
      const bridge = await loadBridge();
      const result = await bridge.launchRunStatus(launchId);
      return bridgeOk(bridgeResultToEnvelope(result, "/launch/run-status"));
    },
  },
  {
    name: "talend_bridge_launch_wait",
    description: "Espera a que una ejecución termine.",
    inputSchema: z.object({
      launchId: z.string().describe("ID de la launch"),
      timeoutMs: z.number().optional().default(60000).describe("Timeout en ms"),
    }),
    handler: async ({ launchId, timeoutMs }: { launchId: string; timeoutMs?: number }) => {
      const bridge = await loadBridge();
      const result = await bridge.launchWait(launchId, timeoutMs);
      return bridgeOk(bridgeResultToEnvelope(result, "/launch/wait"));
    },
  },
];
