import { z } from "zod/v4";
import type { CallToolResult } from "@modelcontextprotocol/server";
import { okResult, errorResult } from "../../../presentation/tools/common/result";

const DescribeSchema = z.object({
  name: z.string().optional().describe("Nombre del componente (tMap, tFileInputDelimited...)"),
  query: z.string().optional().describe("Texto a buscar en el catálogo (si no se da name)"),
});

export function createComponentDescribeTool() {
  return {
    name: "talend_component_describe",
    description: "Describe un componente Talend: parámetros, esquemas y conexiones. source indica de dónde salen los datos (catalog / studio).",
    inputSchema: DescribeSchema,
    annotations: { readOnly: true },
    handler: async (input: z.infer<typeof DescribeSchema>): Promise<CallToolResult> => {
      try {
        if (!input.name && !input.query) {
          return errorResult("component-describe", "MISSING_NAME", "Indica name (componente) o query (búsqueda).") as unknown as CallToolResult;
        }
        const { searchCatalog, inspectCatalogComponent } = await import("../../../talend/components/component-catalog-store");
        if (input.name) {
          const component = await inspectCatalogComponent(input.name);
          if (!component) {
            return errorResult("component-describe", "NOT_FOUND", `No hay ningún componente llamado '${input.name}'. Busca con query.`) as unknown as CallToolResult;
          }
          return okResult({
            name: input.name,
            source: "catalog",
            parameters: (component as any).parameters ?? [],
            connectors: (component as any).connectors ?? [],
            family: (component as any).family,
          }, "component-describe") as unknown as CallToolResult;
        }
        const results = await searchCatalog(input.query!, 20);
        return okResult({
          query: input.query,
          source: "catalog",
          results: results.map((r: any) => ({ name: r.name, family: r.family })),
          count: results.length,
        }, "component-describe") as unknown as CallToolResult;
      } catch (err) {
        return errorResult("component-describe", "DESCRIBE_ERROR", `Error describiendo componente: ${err}`) as unknown as CallToolResult;
      }
    },
  };
}
