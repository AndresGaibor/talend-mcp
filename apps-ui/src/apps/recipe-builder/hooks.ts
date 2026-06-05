import { useState, useCallback } from "react";
import { useCallTool } from "../../openai/useCallTool";
import type { Recipe, RecipeComponent } from "./types";

interface UseRecipeState {
  recipe: Recipe | null;
  explanation: string | null;
  isLoading: boolean;
  error: string | null;
}

export function useRecipe(objective: string) {
  const { execute: callTool } = useCallTool();
  const [state, setState] = useState<UseRecipeState>({
    recipe: null,
    explanation: null,
    isLoading: false,
    error: null,
  });

  const generateRecipe = useCallback(async () => {
    if (!objective.trim()) {
      setState((prev) => ({ ...prev, error: "Ingresa un objetivo para generar la receta" }));
      return;
    }

    setState({ recipe: null, explanation: null, isLoading: true, error: null });

    try {
      const result = await callTool("talend_recipe_generate", { objective });

      if (result.ok && result.data) {
        const data = result.data as { recipe: Recipe; explanation: string };
        setState({
          recipe: data.recipe,
          explanation: data.explanation,
          isLoading: false,
          error: null,
        });
      } else {
        setState({
          recipe: null,
          explanation: null,
          isLoading: false,
          error: result.error || "Error al generar receta",
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Error desconocido";
      setState({
        recipe: null,
        explanation: null,
        isLoading: false,
        error: errorMessage,
      });
    }
  }, [objective, callTool]);

  return {
    ...state,
    generateRecipe,
  };
}

interface UseRecipeDetailsState {
  recipe: Recipe | null;
  isLoading: boolean;
  error: string | null;
}

export function useRecipeDetails(recipeId: string) {
  const { execute: callTool } = useCallTool();
  const [state, setState] = useState<UseRecipeDetailsState>({
    recipe: null,
    isLoading: false,
    error: null,
  });

  const fetchRecipeDetails = useCallback(async () => {
    if (!recipeId) return;

    setState({ recipe: null, isLoading: true, error: null });

    try {
      const result = await callTool("talend_recipe_get", { recipeId });

      if (result.ok && result.data) {
        const recipe = result.data as Recipe;
        setState({ recipe, isLoading: false, error: null });
      } else {
        setState({
          recipe: null,
          isLoading: false,
          error: result.error || "Receta no encontrada",
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Error desconocido";
      setState({ recipe: null, isLoading: false, error: errorMessage });
    }
  }, [recipeId, callTool]);

  return {
    ...state,
    fetchRecipeDetails,
  };
}

export function useRecipeComponents(components: RecipeComponent[]) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const selectComponent = useCallback((index: number | null) => {
    setSelectedIndex(index);
  }, []);

  return {
    selectedIndex,
    selectComponent,
    selectedComponent: selectedIndex !== null ? components[selectedIndex] : null,
  };
}