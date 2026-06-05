import * as z from "zod/v4";
import { bridgeOk, bridgeFail } from "./tools-base";
import { RecipeGeneratorUseCase, type Recipe } from "../../modules/component-knowledge/application/recipe-generator.use-case";

const recipeUseCase = new RecipeGeneratorUseCase();

const recipeCache: Map<string, Recipe> = new Map();

async function generateRecipe(objective: string): Promise<Recipe> {
  return recipeUseCase.generateRecipe(objective);
}

async function getRecipe(recipeId: string): Promise<Recipe | null> {
  const cached = recipeCache.get(recipeId);
  if (cached) return cached;

  const recipe = recipeUseCase.getRecipe(recipeId);
  if (recipe) {
    recipeCache.set(recipeId, recipe);
    return recipe;
  }

  return null;
}

async function explainRecipe(recipe: Recipe): Promise<string> {
  return recipeUseCase.explainRecipe(recipe);
}

async function toPipelineSpec(recipe: Recipe): Promise<ReturnType<RecipeGeneratorUseCase["toPipelineSpec"]>> {
  return recipeUseCase.toPipelineSpec(recipe);
}

export const recipeTools = [
  {
    name: "talend_recipe_generate",
    description: "Genera una receta de componentes Talend basada en un objetivo del usuario. Analiza el objetivo y recomienda la secuencia óptima de componentes.",
    inputSchema: z.object({
      objective: z.string().describe("Objetivo del pipeline. Ejemplos: 'leer CSV, limpiar nulos, cargar a SingleStore', 'leer de MySQL, transformar, guardar en archivo'"),
    }),
    handler: async ({ objective }: { objective: string }) => {
      try {
        if (!objective || objective.trim().length === 0) {
          return bridgeFail({
            ok: false,
            source: "recipe-generator",
            confidence: "low",
            endpoint: "/recipe/generate",
            error: { code: "INVALID_OBJECTIVE", message: "El objetivo no puede estar vacío" },
          });
        }

        const recipe = await generateRecipe(objective);
        recipeCache.set(recipe.id, recipe);

        return bridgeOk({
          ok: true,
          source: "recipe-generator",
          confidence: recipe.confidence >= 0.8 ? "high" : recipe.confidence >= 0.6 ? "medium" : "low",
          endpoint: "/recipe/generate",
          data: {
            recipe,
            explanation: recipe.explanation,
          },
        });
      } catch (err) {
        return bridgeFail({
          ok: false,
          source: "recipe-generator",
          confidence: "low",
          endpoint: "/recipe/generate",
          error: { code: "GENERATION_FAILED", message: String(err) },
        });
      }
    },
  },
  {
    name: "talend_recipe_explain",
    description: "Explica por qué se recomiendan ciertos componentes en una receta específica.",
    inputSchema: z.object({
      recipeId: z.string().describe("ID de la receta a explicar"),
    }),
    handler: async ({ recipeId }: { recipeId: string }) => {
      try {
        const recipe = await getRecipe(recipeId);
        if (!recipe) {
          return bridgeFail({
            ok: false,
            source: "recipe-generator",
            confidence: "low",
            endpoint: "/recipe/explain",
            error: { code: "RECIPE_NOT_FOUND", message: `Receta no encontrada: ${recipeId}` },
          });
        }

        const explanation = await explainRecipe(recipe);

        return bridgeOk({
          ok: true,
          source: "recipe-generator",
          confidence: "high",
          endpoint: "/recipe/explain",
          data: {
            recipeId: recipe.id,
            objective: recipe.objective,
            components: recipe.components,
            flow: recipe.flow,
            explanation,
            confidence: recipe.confidence,
          },
        });
      } catch (err) {
        return bridgeFail({
          ok: false,
          source: "recipe-generator",
          confidence: "low",
          endpoint: "/recipe/explain",
          error: { code: "EXPLANATION_FAILED", message: String(err) },
        });
      }
    },
  },
  {
    name: "talend_recipe_to_pipeline_spec",
    description: "Convierte una receta a una especificación de pipeline lista para generar un job de Talend.",
    inputSchema: z.object({
      recipeId: z.string().describe("ID de la receta a convertir"),
    }),
    handler: async ({ recipeId }: { recipeId: string }) => {
      try {
        const recipe = await getRecipe(recipeId);
        if (!recipe) {
          return bridgeFail({
            ok: false,
            source: "recipe-generator",
            confidence: "low",
            endpoint: "/recipe/to-pipeline-spec",
            error: { code: "RECIPE_NOT_FOUND", message: `Receta no encontrada: ${recipeId}` },
          });
        }

        const pipelineSpec = await toPipelineSpec(recipe);

        return bridgeOk({
          ok: true,
          source: "recipe-generator",
          confidence: "high",
          endpoint: "/recipe/to-pipeline-spec",
          data: {
            recipeId: recipe.id,
            pipelineSpec,
          },
        });
      } catch (err) {
        return bridgeFail({
          ok: false,
          source: "recipe-generator",
          confidence: "low",
          endpoint: "/recipe/to-pipeline-spec",
          error: { code: "CONVERSION_FAILED", message: String(err) },
        });
      }
    },
  },
];
