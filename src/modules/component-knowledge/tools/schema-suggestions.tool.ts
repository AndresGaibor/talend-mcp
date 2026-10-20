import { z } from "zod/v4";
import type { CallToolResult } from "@modelcontextprotocol/server";
import { getSchemaMapping } from "../application/component-knowledge.container";

export const SchemaSuggestionsSchema = z.object({
  schemaFromId: z.string().describe("Componente origen del schema"),
  schemaToId: z.string().describe("Componente destino del schema"),
});

export type SchemaSuggestionsInput = z.infer<typeof SchemaSuggestionsSchema>;

export function createSchemaSuggestionsTool() {
  return {
    name: "talend_components_get_mapping_suggestions",
    description:
      "Sugiere mapeos entre las columnas de dos schemas con un nivel de confianza. Solo lectura.",
    inputSchema: SchemaSuggestionsSchema,
    annotations: {
      readOnly: true,
    },
    handler: async (input: SchemaSuggestionsInput): Promise<CallToolResult> => {
      try {
        const useCase = getSchemaMapping();
        const from = await useCase.extractSchema(input.schemaFromId);
        const to = await useCase.extractSchema(input.schemaToId);

        if (!from || !to) {
          const missing = !from ? input.schemaFromId : input.schemaToId;
          return {
            content: [{ type: "text", text: `No se encontró schema para '${missing}'.` }],
            isError: true,
          };
        }

        const suggestions = useCase.suggestMappings(from, to);

        return {
          content: [{ type: "text", text: `${suggestions.length} sugerencia(s) de mapeo.` }],
          structuredContent: {
            mappings: suggestions.map((s) => ({
              sourceColumn: s.fromColumn,
              targetColumn: s.toColumn,
              confidence: s.confidence,
              reason: s.reason,
            })),
          } as any,
          isError: false,
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error generando sugerencias de mapeo: ${err}` }],
          isError: true,
        };
      }
    },
  };
}
