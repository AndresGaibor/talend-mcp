import { z } from "zod/v4";
import type { CallToolResult } from "@modelcontextprotocol/server";
import { getSchemaMapping } from "../application/component-knowledge.container";

export const SchemaExtractSchema = z.object({
  componentId: z.string().describe("Nombre del componente del catálogo"),
});

export type SchemaExtractInput = z.infer<typeof SchemaExtractSchema>;

export function createSchemaExtractTool() {
  return {
    name: "talend_components_extract_schema",
    description:
      "Extrae la definición de schema (nombre, tipo y columnas) de un componente del catálogo. Solo lectura.",
    inputSchema: SchemaExtractSchema,
    annotations: {
      readOnly: true,
    },
    handler: async (input: SchemaExtractInput): Promise<CallToolResult> => {
      try {
        const schema = await getSchemaMapping().extractSchema(input.componentId);

        if (!schema) {
          return {
            content: [
              { type: "text", text: `No se encontró schema para el componente '${input.componentId}'.` },
            ],
            isError: true,
          };
        }

        return {
          content: [{ type: "text", text: `Schema '${schema.name}' (${schema.type}) extraído.` }],
          structuredContent: { schema } as any,
          isError: false,
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error extrayendo el schema: ${err}` }],
          isError: true,
        };
      }
    },
  };
}
