import { useState } from "react";
import type { ComponentParameter } from "../types";

interface ComponentParametersTableProps {
  parameters: ComponentParameter[];
  onEditParam: (name: string, value: string) => void;
}

export function ComponentParametersTable({ parameters, onEditParam }: ComponentParametersTableProps) {
  const [search, setSearch] = useState("");
  const [showHidden, setShowHidden] = useState(false);

  const filtered = parameters.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.value.toLowerCase().includes(search.toLowerCase());
    const matchesShow = showHidden ? true : p.show !== false;
    return matchesSearch && matchesShow;
  });

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col h-full">
      {/* Table Filters */}
      <div className="p-4 border-b border-gray-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gray-50/50">
        <div className="relative flex-1 max-w-xs">
          <input
            type="text"
            placeholder="Filtrar parámetros..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white"
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

        <label className="flex items-center space-x-2 text-xs text-gray-500 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showHidden}
            onChange={(e) => setShowHidden(e.target.checked)}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
          />
          <span>Mostrar parámetros ocultos</span>
        </label>
      </div>

      {/* Table Data */}
      <div className="flex-1 overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50/30 text-gray-400 text-[10px] font-semibold tracking-wider border-b border-gray-100">
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Valor</th>
              <th className="px-4 py-3">Campo/Tipo</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 text-xs text-gray-700">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-400 text-xs">
                  No hay parámetros que coincidan con los criterios
                </td>
              </tr>
            ) : (
              filtered.map((param) => (
                <tr key={param.name} className="hover:bg-gray-50/50 transition-colors group">
                  <td className="px-4 py-3 font-semibold font-mono text-[11px] text-gray-600">
                    {param.name}
                  </td>
                  <td className="px-4 py-3 break-all font-mono text-[11px] text-blue-950 max-w-xs md:max-w-md">
                    {param.value || <span className="text-gray-300 italic">vacío</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded text-[10px] bg-gray-100 text-gray-600 font-medium">
                      {param.field || "TEXT"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => onEditParam(param.name, param.value)}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100"
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
