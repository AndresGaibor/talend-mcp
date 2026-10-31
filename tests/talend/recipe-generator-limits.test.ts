import { describe, expect, test } from "bun:test";
import { RecipeGeneratorUseCase } from "../../src/modules/component-knowledge/application/recipe-generator.use-case";

/**
 * El Map de recetas crecia con cada llamada y el proceso vive dias: se
 * conservan las mas recientes y se descartan las antiguas.
 */
describe("recetas en memoria", () => {
  test("conserva las ultimas y descarta las antiguas", () => {
    const generador = new RecipeGeneratorUseCase();

    const recetas = Array.from({ length: 250 }, (_, i) => generador.generateRecipe(`objetivo unico ${i}`));
    const primera = recetas[0]!;
    const ultima = recetas[recetas.length - 1]!;

    expect(generador.getRecipe(ultima.id)).toBeDefined();
    expect(generador.getRecipe(primera.id)).toBeUndefined();
  });
});
