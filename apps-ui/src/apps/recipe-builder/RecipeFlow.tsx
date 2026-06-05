import type { RecipeComponent } from "./types";

interface RecipeFlowProps {
  components: RecipeComponent[];
}

export function RecipeFlow({ components }: RecipeFlowProps) {
  if (!components || components.length === 0) {
    return (
      <p className="text-gray-500 text-center py-8">
        No hay componentes en esta receta
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {components.map((component, index) => (
        <div key={component.id} className="flex items-center">
          <div className="flex flex-col items-center">
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 min-w-[140px] text-center">
              <span className="text-xs text-blue-500 font-medium">
                {component.family}
              </span>
              <p className="font-semibold text-gray-900 mt-1">{component.name}</p>
              {component.description && (
                <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                  {component.description}
                </p>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-2 max-w-[140px] text-center">
              {component.purpose}
            </p>
          </div>

          {index < components.length - 1 && (
            <div className="flex items-center px-2">
              <svg
                className="w-5 h-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}