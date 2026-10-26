import type { Recipe, PipelineSpec } from "./recipe-generator/types";
import { findBestMatch } from "./recipe-generator/pattern-matcher";
import { generateFallbackRecipe } from "./recipe-generator/fallback-recipe";
import { buildPipelineSpec } from "./recipe-generator/pipeline-spec-builder";

export type { PipelineSpec, Recipe } from "./recipe-generator/types";

/**
 * Genera recetas de componentes a partir de un objetivo y las conserva en
 * memoria para que `talend_recipe_get` pueda recuperarlas.
 */
export class RecipeGeneratorUseCase {
  private recipes: Map<string, Recipe> = new Map();

  generateRecipe(objective: string): Recipe {
    const normalizedObjective = objective.toLowerCase().trim();
    const matchedPattern = findBestMatch(normalizedObjective);

    if (matchedPattern) {
      const recipe: Recipe = {
        id: crypto.randomUUID(),
        objective: objective,
        components: [...matchedPattern.components],
        flow: [...matchedPattern.flow],
        explanation: matchedPattern.explanation,
        confidence: matchedPattern.confidence,
      };
      this.recipes.set(recipe.id, recipe);
      return recipe;
    }

    const fallbackRecipe = generateFallbackRecipe(objective, normalizedObjective);
    this.recipes.set(fallbackRecipe.id, fallbackRecipe);
    return fallbackRecipe;
  }

  explainRecipe(recipe: Recipe): string {
    return recipe.explanation;
  }

  toPipelineSpec(recipe: Recipe): PipelineSpec {
    return buildPipelineSpec(recipe);
  }

  getRecipe(id: string): Recipe | undefined {
    return this.recipes.get(id);
  }
}
