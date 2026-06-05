import type { RecipeComponent } from "./types";

interface RecipeExplanationProps {
  components: RecipeComponent[];
  explanation: string;
}

export function RecipeExplanation({ components, explanation }: RecipeExplanationProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">
          Explicación de la receta
        </h3>
        <p className="text-gray-600 leading-relaxed">{explanation}</p>
      </div>

      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-3">
          ¿Por qué estos componentes?
        </h4>
        <div className="space-y-3">
          {components.map((component) => (
            <div
              key={component.id}
              className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg"
            >
              <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-xs font-bold text-blue-600">
                  {component.order}
                </span>
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900">{component.name}</p>
                <p className="text-sm text-gray-500 mt-0.5">{component.purpose}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}