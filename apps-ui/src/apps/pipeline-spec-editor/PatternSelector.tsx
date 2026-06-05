import type { Pattern } from "./PipelineSpecEditorApp";

interface PatternSelectorProps {
  patterns: Pattern[];
  onSelect: (pattern: Pattern) => void;
  isLoading: boolean;
  sessionMappings: Record<string, unknown> | null;
}

export function PatternSelector({
  patterns,
  onSelect,
  isLoading,
  sessionMappings,
}: PatternSelectorProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Loading patterns...</div>
      </div>
    );
  }

  if (patterns.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 mb-4">No patterns available</p>
        <p className="text-sm text-gray-400">
          Contact your administrator to configure pipeline patterns.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">Select a Pattern</h3>
      {sessionMappings && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <span className="text-sm text-blue-700">
            Session mappings available: {Object.keys(sessionMappings).length} items
          </span>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {patterns.map((pattern) => (
          <button
            key={pattern.id}
            onClick={() => onSelect(pattern)}
            className="p-4 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors text-left"
          >
            <span className="text-sm font-medium text-gray-900">{pattern.name}</span>
            <p className="text-sm text-gray-500 mt-1">{pattern.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
