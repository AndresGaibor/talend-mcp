import { z } from "zod/v4";
import type { CallToolResult } from "@modelcontextprotocol/server";
import { getRecipeGenerator } from "../application/component-knowledge.container";

export const RecipeGetSchema = z.object({
  recipeId: z.string().describe("Identificador de la receta, devuelto por talend_recipe_generate"),
});

export type RecipeGetInput = z.infer<typeof RecipeGetSchema>;

export function createRecipeGetTool() {
  return {
    name: "talend_recipe_get",
    description: "Obtiene una receta generada previamente por su identificador. Solo lectura.",
    inputSchema: RecipeGetSchema,
    annotations: {
      readOnly: true,
    },
    handler: async (input: RecipeGetInput): Promise<CallToolResult> => {
      try {
        const recipe = getRecipeGenerator().getRecipe(input.recipeId);

        if (!recipe) {
          return {
            content: [{ type: "text", text: `Receta '${input.recipeId}' no encontrada.` }],
            isError: true,
          };
        }

        return {
          content: [{ type: "text", text: recipe.explanation }],
          structuredContent: { recipe } as any,
          isError: false,
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error obteniendo la receta: ${err}` }],
          isError: true,
        };
      }
    },
  };
}
