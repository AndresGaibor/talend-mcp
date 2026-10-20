import { RecipeGeneratorUseCase } from "./recipe-generator.use-case";
import { SchemaMappingUseCase } from "./schema-mapping.use-case";

/**
 * Instancias compartidas de los casos de uso del módulo.
 *
 * `RecipeGeneratorUseCase` guarda las recetas generadas en memoria, así que
 * `talend_recipe_generate` y `talend_recipe_get` deben compartir la misma
 * instancia para que una receta generada pueda consultarse después.
 */

let recipeGenerator: RecipeGeneratorUseCase | undefined;
let schemaMapping: SchemaMappingUseCase | undefined;

export function getRecipeGenerator(): RecipeGeneratorUseCase {
  recipeGenerator ??= new RecipeGeneratorUseCase();
  return recipeGenerator;
}

export function getSchemaMapping(): SchemaMappingUseCase {
  schemaMapping ??= new SchemaMappingUseCase();
  return schemaMapping;
}
