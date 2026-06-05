import { useState } from "react";
import { AppHeader, LoadingState, ErrorBanner } from "../../design-system";
import { Card } from "../../components/Card";
import { Button } from "../../components/Button";
import { useRecipe } from "./hooks";
import { RecipeFlow } from "./RecipeFlow";
import { RecipeExplanation } from "./RecipeExplanation";

export function RecipeBuilderApp() {
  const [objective, setObjective] = useState("");
  const { recipe, explanation, isLoading, error, generateRecipe } = useRecipe(objective);

  const handleGenerate = () => {
    generateRecipe();
  };

  return (
    <div className="space-y-6">
      <AppHeader
        title="Recipe Builder"
        subtitle="Describe tu objetivo y obtén la secuencia recomendada de componentes"
      />

      {error && <ErrorBanner message={error} onDismiss={() => {}} />}

      <Card className="p-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Objetivo de integración
            </label>
            <textarea
              className="w-full border border-gray-200 rounded-lg p-4 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[120px]"
              placeholder="Ej: Leer un archivo CSV, limpiar valores nulos y cargar a SingleStore"
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
            />
          </div>

          <div className="flex justify-end">
            <Button
              variant="primary"
              onClick={handleGenerate}
              disabled={isLoading || !objective.trim()}
            >
              {isLoading ? "Generando..." : "Generar Receta"}
            </Button>
          </div>
        </div>
      </Card>

      {isLoading && <LoadingState message="Analizando objetivo y generando receta..." />}

      {recipe && !isLoading && (
        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Componentes recomendados
            </h3>
            <RecipeFlow components={recipe.components} />
          </Card>

          <Card className="p-6">
            <RecipeExplanation
              components={recipe.components}
              explanation={explanation || ""}
            />
          </Card>
        </div>
      )}
    </div>
  );
}