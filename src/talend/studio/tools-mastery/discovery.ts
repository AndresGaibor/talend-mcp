/**
 * Descubrimiento de componentes: mastery individual y de todo el catalogo.
 */
import * as z from "zod/v4";
import { bridgeOk } from "../tools-base";

export const masteryDiscoveryTools = [
  {
    name: "talend_mastery_component",
    description: "Ejecuta mastery para un componente específico.",
    inputSchema: z.object({
      componentName: z.string().describe("Nombre del componente"),
    }),
    handler: async ({ componentName }: { componentName: string }) => {
      const { masteryComponent } = await import("../../mastery/component-mastery-runner");
      const result = await masteryComponent(componentName);
      return bridgeOk({
        ok: true,
        source: "workspace-files",
        confidence: "high",
        endpoint: "/mastery/component",
        data: result,
      });
    },
  },
  {
    name: "talend_mastery_all_components",
    description: "Ejecuta mastery para todos los componentes del catálogo.",
    inputSchema: z.object({}),
    handler: async () => {
      const { masteryAllComponents } = await import("../../mastery/component-mastery-runner");
      const result = await masteryAllComponents();
      return bridgeOk({
        ok: true,
        source: "workspace-files",
        confidence: "high",
        endpoint: "/mastery/all-components",
        data: result,
      });
    },
  },
];
