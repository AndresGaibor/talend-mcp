import { useEffect, useState } from "react";
import { useSelectedComponents, useMappingSuggestions } from "./hooks";
import { SchemaTable } from "./SchemaTable";
import { MappingList } from "./MappingList";
import type { MappingSuggestion } from "./types";

export function SchemaMappingStudioApp() {
  const { inputSchema, outputSchema, fetchSelectedComponents, isLoading: isLoadingComponents } = useSelectedComponents();
  const { suggestions, getSuggestions, isLoading: isLoadingSuggestions } = useMappingSuggestions("", "");
  const [mappings, setMappings] = useState<MappingSuggestion[]>([]);

  useEffect(() => {
    fetchSelectedComponents();
  }, [fetchSelectedComponents]);

  useEffect(() => {
    if (inputSchema && outputSchema) {
      getSuggestions();
    }
  }, [inputSchema, outputSchema]);

  useEffect(() => {
    if (suggestions?.mappings) {
      setMappings(suggestions.mappings);
    }
  }, [suggestions]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Schema Mapping Studio</h1>
      <p className="text-sm text-gray-500 mt-1">
        Visualize input/output schemas and get mapping suggestions
      </p>

      <div className="grid grid-cols-2 gap-4 mt-6">
        <div>
          <h3 className="text-lg font-semibold mb-2">Input Schema</h3>
          <SchemaTable schema={inputSchema} title="Input" />
        </div>
        <div>
          <h3 className="text-lg font-semibold mb-2">Output Schema</h3>
          <SchemaTable schema={outputSchema} title="Output" />
        </div>
      </div>

      <div className="mt-6">
        <h3 className="text-lg font-semibold mb-2">Mappings sugeridos</h3>
        {isLoadingComponents || isLoadingSuggestions ? (
          <p className="text-sm text-gray-500">Loading suggestions...</p>
        ) : (
          <MappingList mappings={mappings} />
        )}
      </div>
    </div>
  );
}
