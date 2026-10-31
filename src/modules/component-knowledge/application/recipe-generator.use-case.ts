import type { Recipe, PipelineSpec } from "./recipe-generator/types";
import { findBestMatch } from "./recipe-generator/pattern-matcher";
import { generateFallbackRecipe } from "./recipe-generator/fallback-recipe";
import { buildPipelineSpec } from "./recipe-generator/pipeline-spec-builder";

export type { PipelineSpec, Recipe } from "./recipe-generator/types";

/**
 * Genera recetas de componentes a partir de un objetivo y las conserva en
 * memoria para que `talend_recipe_get` pueda recuperarlas.
 */
/**
 * Recetas que se conservan en memoria.
 *
 * Cada receta es pequeña, pero el proceso vive dias y `generateRecipe` no
 * borraba ninguna: el Map crecia con cada llamada. Se descartan las mas
 * antiguas; las recientes, que son las que se consultan, se quedan.
 */
const MAX_RECETAS = 200;

export class RecipeGeneratorUseCase {
  private recipes: Map<string, Recipe> = new Map();

  private guardar(recipe: Recipe): Recipe {
    this.recipes.set(recipe.id, recipe);
    while (this.recipes.size > MAX_RECETAS) {
      const masAntigua = this.recipes.keys().next().value;
      if (masAntigua === undefined) break;
      this.recipes.delete(masAntigua);
    }
    return recipe;
  }

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
      return this.guardar(recipe);
    }

    return this.guardar(generateFallbackRecipe(objective, normalizedObjective));
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
