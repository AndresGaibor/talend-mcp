import { z } from "zod/v4";
import type { CallToolResult } from "@modelcontextprotocol/server";
import { getRecipeGenerator } from "../application/component-knowledge.container";

export const RecipeGenerateSchema = z.object({
  objective: z.string().describe("Objetivo del flujo, por ejemplo 'leer un CSV y cargar a base de datos'"),
});

export type RecipeGenerateInput = z.infer<typeof RecipeGenerateSchema>;

export function createRecipeGenerateTool() {
  return {
    name: "talend_recipe_generate",
    description:
      "Genera una receta de flujo Talend (componentes y conexiones sugeridos) a partir de un objetivo en lenguaje natural. Solo lectura.",
    inputSchema: RecipeGenerateSchema,
    annotations: {
      readOnly: true,
    },
    handler: async (input: RecipeGenerateInput): Promise<CallToolResult> => {
      try {
        const objective = input.objective?.trim();
        if (!objective) {
          return {
            content: [{ type: "text", text: "El objetivo no puede estar vacío." }],
            isError: true,
          };
        }

        const recipe = getRecipeGenerator().generateRecipe(objective);

        return {
          content: [{ type: "text", text: recipe.explanation }],
          structuredContent: {
            recipe,
            explanation: recipe.explanation,
          } as any,
          isError: false,
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error generando la receta: ${err}` }],
          isError: true,
        };
      }
    },
  };
}
