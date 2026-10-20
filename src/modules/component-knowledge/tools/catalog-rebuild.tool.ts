import { z } from "zod/v4";
import type { CallToolResult } from "@modelcontextprotocol/server";

export const CatalogRebuildSchema = z.object({
  pluginsDir: z.string().optional().describe("Directorio de plugins de Talend Studio"),
  talendStudioHome: z.string().optional().describe("Raíz de la instalación de Talend Studio"),
});

export type CatalogRebuildInput = z.infer<typeof CatalogRebuildSchema>;

export function createCatalogRebuildTool() {
  return {
    name: "talend_components_catalog_rebuild",
    description:
      "Reconstruye el catálogo de componentes instalados reescaneando los plugins de Talend Studio. Modifica la caché local.",
    inputSchema: CatalogRebuildSchema,
    annotations: {
      readOnly: false,
      destructive: false,
    },
    handler: async (input: CatalogRebuildInput): Promise<CallToolResult> => {
      try {
        const { saveComponentCatalog } = await import("../../../talend/components/component-catalog-store");

        const catalog = await saveComponentCatalog({
          pluginsDir: input.pluginsDir,
          talendStudioHome: input.talendStudioHome,
        });

        return {
          content: [
            {
              type: "text",
              text: catalog.ok
                ? `Catálogo reconstruido con ${catalog.entryCount} componente(s).`
                : `No se pudo reconstruir el catálogo: ${catalog.errors.join("; ")}`,
            },
          ],
          structuredContent: { catalog } as any,
          isError: !catalog.ok,
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error reconstruyendo el catálogo: ${err}` }],
          isError: true,
        };
      }
    },
  };
}
