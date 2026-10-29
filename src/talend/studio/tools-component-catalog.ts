import * as z from "zod/v4";
import { bridgeOk, loadBridge } from "./tools-base";

export const componentCatalogTools = [
  {
    name: "talend_studio_list_components",
    description: "Lista los componentes del catalogo de Talend Studio. Sirve para saber que componentes hay disponibles antes de crear un job.",
    inputSchema: z.object({
      filter: z.string().optional().describe("Texto que tiene que aparecer en el nombre del componente"),
      limit: z.number().optional().describe("Maximo de componentes a devolver"),
      paletteType: z.enum(["DI", "SPARK", "SPARKSTREAMING", "STRUCTUREDSTREAMING", "OTHER", "*"]).optional().describe("Paleta de Studio; * incluye todas las paletas"),
    }),
    handler: async ({ filter, limit, paletteType }: { filter?: string; limit?: number; paletteType?: string }) => {
      const bridge = await loadBridge();
      const result = await bridge.listComponents({ filter, limit, paletteType });
      return bridgeOk({
        ok: result.ok,
        source: result.source,
        confidence: result.confidence,
        endpoint: "/automation/components",
        data: result.data,
        error: result.error,
      });
    },
  },
  {
    name: "talend_studio_component_parameters",
    description: "Devuelve los parametros de un componente del catalogo de Talend, con su tipo y su valor por defecto. Es la forma de saber como se configura un componente sin adivinar.",
    inputSchema: z.object({
      name: z.string().describe("Nombre del componente"),
    }),
    handler: async ({ name }: { name: string }) => {
      const bridge = await loadBridge();
      const result = await bridge.componentParameters({ name });
      return bridgeOk({
        ok: result.ok,
        source: result.source,
        confidence: result.confidence,
        endpoint: "/automation/components/parameters",
        data: result.data,
        error: result.error,
      });
    },
  },
];
