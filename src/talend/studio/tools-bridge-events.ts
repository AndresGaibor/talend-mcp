import * as z from "zod/v4";
import { bridgeOk, bridgeResultToEnvelope, loadBridge } from "./tools-base";

export const bridgeEventTools = [
  {
    name: "talend_bridge_events_recent",
    description: "Obtiene eventos recientes del bridge.",
    inputSchema: z.object({}),
    handler: async () => {
      const bridge = await loadBridge();
      const result = await bridge.eventsRecent();
      return bridgeOk(bridgeResultToEnvelope(result, "/events/recent"));
    },
  },
  {
    name: "talend_bridge_events_clear",
    description: "Limpia los eventos del bridge.",
    inputSchema: z.object({}),
    handler: async () => {
      const bridge = await loadBridge();
      const result = await bridge.eventsClear();
      return bridgeOk(bridgeResultToEnvelope(result, "/events/clear"));
    },
  },
];
