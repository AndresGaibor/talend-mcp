import type { PipelineSpec, Recipe } from "./types";

/** Convierte una receta en la especificación de pipeline que consumen las tools. */
export function buildPipelineSpec(recipe: Recipe): PipelineSpec {
  const components = recipe.components.map((comp, idx) => {
    const posX = 100 + idx * 200;
    const posY = 200;
    return {
      uniqueName: `${comp}_${idx + 1}`,
      componentName: comp,
      posX,
      posY,
      label: comp,
      parameters: {},
    };
  });

  const connections: Array<{ source: string; target: string; label: string }> = [];
  for (let i = 0; i < recipe.components.length - 1; i++) {
    connections.push({
      source: `${recipe.components[i]}_${i + 1}`,
      target: `${recipe.components[i + 1]}_${i + 2}`,
      label: `Flow_${i + 1}`,
    });
  }

  return {
    name: `Recipe_${recipe.id.slice(0, 8)}`,
    description: recipe.objective,
    components,
    connections,
  };
}
