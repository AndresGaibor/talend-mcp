import { Card } from "../../components/Card";

interface MigrationSuggestion {
  originalContext: string;
  recommendedContext: string;
  reason: string;
}

interface ContextMigrationPanelProps {
  suggestions: MigrationSuggestion[];
  onApplySuggestion?: (suggestion: MigrationSuggestion) => void;
}

export function ContextMigrationPanel({ suggestions, onApplySuggestion }: ContextMigrationPanelProps) {
  if (suggestions.length === 0) {
    return (
      <Card className="p-6 text-center text-gray-500">
        No context migration suggestions available.
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">
        Context Migration Suggestions
      </h3>
      {suggestions.map((suggestion, index) => (
        <Card key={index} className="p-4 border-l-4 border-blue-400">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-2">
              <div>
                <span className="text-xs text-gray-400">Current</span>
                <p className="text-sm font-mono text-gray-700 bg-gray-50 p-2 rounded mt-1">
                  {suggestion.originalContext}
                </p>
              </div>
              <div>
                <span className="text-xs text-gray-400">Recommended</span>
                <p className="text-sm font-mono text-green-600 bg-green-50 p-2 rounded mt-1">
                  {suggestion.recommendedContext}
                </p>
              </div>
              <p className="text-xs text-gray-500 mt-2">{suggestion.reason}</p>
            </div>
            {onApplySuggestion && (
              <button
                onClick={() => onApplySuggestion(suggestion)}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Apply
              </button>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}