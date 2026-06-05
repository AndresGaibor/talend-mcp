import { useState, useCallback } from "react";
import { useCallTool } from "../../openai/useCallTool";
import { Card } from "../../components/Card";
import { Button } from "../../components/Button";
import type { ComponentInfo } from "./types";

interface ComponentSearchProps {
  onSelectComponent: (component: ComponentInfo) => void;
  selectedComponent: ComponentInfo | null;
}

export function ComponentSearch({ onSelectComponent, selectedComponent }: ComponentSearchProps) {
  const { execute: callTool, isLoading } = useCallTool();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ComponentInfo[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchComponents = useCallback(async () => {
    if (!query.trim()) return;
    setError(null);
    setHasSearched(false);

    const result = await callTool("talend_components_search", { query });
    if (result.ok && result.data) {
      const data = result.data as any;
      if (data.ok) {
        setResults(data.components || []);
      } else {
        setError(data.error?.message || "Búsqueda falló");
      }
    } else {
      setError(result.error || "Error en búsqueda");
    }
    setHasSearched(true);
  }, [query, callTool]);

  const scanInstalled = useCallback(async () => {
    setError(null);
    setQuery("");
    setHasSearched(false);

    const result = await callTool("talend_components_scan_installed", {});
    if (result.ok && result.data) {
      const data = result.data as any;
      if (data.ok) {
        setResults(data.components || []);
      } else {
        setError(data.error?.message || "Scan falló");
      }
    } else {
      setError(result.error || "Error en scan");
    }
    setHasSearched(true);
  }, [callTool]);

  return (
    <Card className="p-4">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Buscar Componentes</h3>
      
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nombre (ej: tMysql, tREST)..."
          className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          onKeyDown={(e) => e.key === "Enter" && searchComponents()}
        />
        <Button variant="primary" onClick={searchComponents} disabled={isLoading || !query.trim()}>
          {isLoading ? "Buscando..." : "Buscar"}
        </Button>
        <Button variant="outline" onClick={scanInstalled} disabled={isLoading}>
          Escanear
        </Button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-md mb-4">
          {error}
        </div>
      )}

      {hasSearched && results.length === 0 && (
        <p className="text-gray-500 text-center py-4">No se encontraron componentes</p>
      )}

      {results.length > 0 && (
        <div className="border border-gray-200 rounded-md max-h-80 overflow-y-auto">
          {results.map((component, idx) => (
            <button
              key={`${component.family}-${component.name}-${idx}`}
              onClick={() => onSelectComponent(component)}
              className={`w-full text-left px-4 py-3 border-b border-gray-100 last:border-b-0 hover:bg-blue-50 transition-colors ${
                selectedComponent?.name === component.name ? "bg-blue-100" : ""
              }`}
            >
              <div className="font-medium text-gray-900">{component.name}</div>
              <div className="text-sm text-gray-500">
                {component.family} {component.version && `• v${component.version}`}
              </div>
              {component.description && (
                <p className="text-sm text-gray-400 mt-1 truncate">{component.description}</p>
              )}
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}
