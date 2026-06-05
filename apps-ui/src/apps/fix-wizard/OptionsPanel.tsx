export interface FixOption {
  id: string;
  description: string;
  confidence: "high" | "medium" | "low";
  changes: Record<string, unknown>;
}

interface OptionsPanelProps {
  options: FixOption[];
  selectedOption: FixOption | null;
  onSelect: (option: FixOption) => void;
  isLoading: boolean;
}

const confidenceStyles = {
  high: "bg-green-100 text-green-800 border-green-200",
  medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
  low: "bg-gray-100 text-gray-600 border-gray-200",
};

const confidenceLabel = {
  high: "High confidence",
  medium: "Medium confidence",
  low: "Low confidence",
};

export function OptionsPanel({ options, selectedOption, onSelect, isLoading }: OptionsPanelProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (options.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No fix options available for this error
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500 mb-4">Select a fix option to apply:</p>
      {options.map((option) => (
        <button
          key={option.id}
          onClick={() => onSelect(option)}
          disabled={isLoading}
          className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
            selectedOption?.id === option.id
              ? "border-blue-500 bg-blue-50"
              : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <p className="text-sm text-gray-900">{option.description}</p>
              {Object.keys(option.changes).length > 0 && (
                <div className="mt-2 text-xs text-gray-500">
                  {Object.keys(option.changes).length} parameter(s) will be modified
                </div>
              )}
            </div>
            <span className={`flex-shrink-0 px-2 py-1 text-xs rounded-full border ${confidenceStyles[option.confidence]}`}>
              {confidenceLabel[option.confidence]}
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}