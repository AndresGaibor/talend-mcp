export interface RecipeComponent {
  id: string;
  name: string;
  family: string;
  description?: string;
  purpose: string;
  order: number;
}

export interface Recipe {
  id: string;
  objective: string;
  components: RecipeComponent[];
  explanation: string;
  createdAt: string;
}

export interface RecipeGenerationResult {
  recipe: Recipe;
  explanation: string;
}