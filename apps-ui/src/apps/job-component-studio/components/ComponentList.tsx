import { useState } from "react";
import type { ActiveJobComponentSummary } from "../types";

interface ComponentListProps {
  components: ActiveJobComponentSummary[];
  selectedName: string | null;
  onSelect: (name: string) => void;
}

export function ComponentList({ components, selectedName, onSelect }: ComponentListProps) {
  const [search, setSearch] = useState("");

  const filtered = components.filter(
    (c) =>
      c.uniqueName.toLowerCase().includes(search.toLowerCase()) ||
      c.label.toLowerCase().includes(search.toLowerCase()) ||
      c.componentName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-4 border-b border-gray-50 bg-gray-50/50">
        <h3 className="font-semibold text-gray-800 text-sm mb-2">Componentes ({components.length})</h3>
        <div className="relative">
          <input
            type="text"
            placeholder="Buscar componente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white"
          />
          <svg
            className="absolute left-3 top-2.5 h-3.5 w-3.5 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-gray-50 p-2 space-y-1">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-xs text-gray-400">
            No se encontraron componentes
          </div>
        ) : (
          filtered.map((comp) => {
            const isSelected = selectedName === comp.uniqueName;
            return (
              <button
                key={comp.uniqueName}
                onClick={() => onSelect(comp.uniqueName)}
                className={`w-full text-left p-3 rounded-xl transition-all duration-200 flex items-start space-x-3 group ${
                  isSelected
                    ? "bg-blue-50/70 border border-blue-100/50 text-blue-900 shadow-sm shadow-blue-500/5"
                    : "hover:bg-gray-50 border border-transparent text-gray-700"
                }`}
              >
                <div className={`p-2 rounded-lg ${
                  isSelected ? "bg-blue-500/10 text-blue-600" : "bg-gray-100 text-gray-500 group-hover:bg-white transition-colors"
                }`}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline">
                    <span className="font-medium text-xs truncate block">
                      {comp.label || comp.uniqueName}
                    </span>
                    {comp.posX !== undefined && comp.posY !== undefined && (
                      <span className="text-[10px] text-gray-400 group-hover:text-gray-500">
                        {comp.posX},{comp.posY}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-gray-400 block truncate font-mono mt-0.5">
                    {comp.uniqueName} ({comp.componentName})
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
