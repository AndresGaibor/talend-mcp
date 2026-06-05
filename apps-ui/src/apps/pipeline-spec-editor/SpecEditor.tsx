import { useState, useCallback } from "react";
import type { PipelineSpec } from "./PipelineSpecEditorApp";

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

interface SpecEditorProps {
  spec: PipelineSpec;
  onChange: (spec: PipelineSpec) => void;
  onValidate: () => void;
  validationResult: ValidationResult | null;
  isLoading: boolean;
}

export function SpecEditor({
  spec,
  onChange,
  onValidate,
  validationResult,
  isLoading,
}: SpecEditorProps) {
  const [localSpec, setLocalSpec] = useState<PipelineSpec>(spec);

  const handleChange = useCallback(
    (value: string) => {
      try {
        const parsed = JSON.parse(value);
        setLocalSpec(parsed);
        onChange(parsed);
      } catch {
        setLocalSpec({ ...localSpec, _raw: value });
        onChange({ ...localSpec, _raw: value });
      }
    },
    [localSpec, onChange]
  );

  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      handleChange(e.target.value);
    },
    [handleChange]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Pipeline Specification</h3>
        <button
          onClick={onValidate}
          disabled={isLoading}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm"
        >
          {isLoading ? "Validating..." : "Validate Spec"}
        </button>
      </div>

      {validationResult && (
        <div
          className={`p-3 rounded-lg ${
            validationResult.valid
              ? "bg-green-50 border border-green-200 text-green-700"
              : "bg-red-50 border border-red-200 text-red-700"
          }`}
        >
          {validationResult.valid ? (
            <span>Spec is valid</span>
          ) : (
            <div>
              <span className="font-medium">Validation errors:</span>
              <ul className="mt-1 list-disc list-inside text-sm">
                {validationResult.errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="relative">
        <textarea
          value={JSON.stringify(localSpec, null, 2)}
          onChange={handleTextChange}
          className="w-full h-96 p-4 font-mono text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="Enter pipeline JSON spec..."
          spellCheck={false}
        />
      </div>

      <p className="text-sm text-gray-500">
        Edit the JSON specification above. The spec will be validated before previewing.
      </p>
    </div>
  );
}
