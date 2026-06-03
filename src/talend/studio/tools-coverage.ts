import * as z from "zod/v4";
import { bridgeOk, bridgeFail, loadBridge } from "./tools-base";
import { getConfiguredProjectPath } from "../workspace";

export const coverageTools = [
  {
    name: "talend_coverage_report",
    description: "Genera un reporte de cobertura de la automatización.",
    inputSchema: z.object({}),
    handler: async () => {
      const { generateCoverageReport } = await import("../coverage/automation-coverage");
      const bridge = await loadBridge();
      const report = await generateCoverageReport({ bridge });
      return bridgeOk({
        ok: true,
        source: "mcp",
        confidence: "high",
        endpoint: "/coverage/report",
        data: report,
      });
    },
  },
];