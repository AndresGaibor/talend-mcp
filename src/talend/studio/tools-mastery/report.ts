/**
 * Informe de mastery del catalogo de componentes.
 */
import * as z from "zod/v4";
import { bridgeOk } from "../tools-base";

export const masteryReportTools = [
  {
    name: "talend_mastery_report",
    description: "Genera un reporte de mastery.",
    inputSchema: z.object({}),
    handler: async () => {
      const { generateMasteryReport } = await import("../../mastery/component-mastery-runner");
      const result = await generateMasteryReport();
      return bridgeOk({
        ok: true,
        source: "workspace-files",
        confidence: "high",
        endpoint: "/mastery/report",
        data: result,
      });
    },
  },
];
