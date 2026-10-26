/**
 * Generacion del fixture de prueba de un componente.
 */
import * as z from "zod/v4";
import { bridgeOk } from "../tools-base";

export const masteryFixtureTools = [
  {
    name: "talend_mastery_generate_fixture",
    description: "Genera un fixture para probar un componente.",
    inputSchema: z.object({
      componentName: z.string().describe("Nombre del componente"),
    }),
    handler: async ({ componentName }: { componentName: string }) => {
      const { masteryGenerateFixture } = await import("../../mastery/component-mastery-runner");
      const result = await masteryGenerateFixture(componentName);
      return bridgeOk({
        ok: result.ok,
        source: result.ok ? "workspace-files" : "unavailable",
        confidence: result.ok ? "high" : "low",
        endpoint: "/mastery/generate-fixture",
        data: result,
      });
    },
  },
];
