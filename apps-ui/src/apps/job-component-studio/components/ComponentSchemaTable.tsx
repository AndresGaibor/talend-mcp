import { useState } from "react";
import type { ComponentSchema } from "../types";

interface ComponentSchemaTableProps {
  schemas: ComponentSchema[];
}

export function ComponentSchemaTable({ schemas }: ComponentSchemaTableProps) {
  const [activeSchemaIdx, setActiveSchemaIdx] = useState(0);

  if (schemas.length === 0) {
    return (
      <div className="bg-white p-8 text-center text-xs text-gray-400 rounded-2xl border border-gray-100 shadow-sm">
        Este componente no expone ningún esquema de datos.
      </div>
    );
  }

  const activeSchema = schemas[activeSchemaIdx] || schemas[0];
  const columns = activeSchema?.columns || [];

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col h-full">
      {/* Schema selector header */}
      <div className="p-4 border-b border-gray-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gray-50/50">
        <div className="space-y-0.5">
          <h3 className="font-semibold text-gray-800 text-sm">Esquemas y Columnas</h3>
          <p className="text-[10px] text-gray-400">Estructura de datos entrantes y salientes</p>
        </div>

        {schemas.length > 1 && (
          <div className="flex gap-1.5 p-1 bg-gray-100 rounded-lg max-w-xs self-start sm:self-center">
            {schemas.map((s, idx) => (
              <button
                key={idx}
                onClick={() => setActiveSchemaIdx(idx)}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                  idx === activeSchemaIdx
                    ? "bg-white text-gray-800 shadow-sm"
                    : "text-gray-500 hover:text-gray-800"
                }`}
              >
                {s.connector || s.label || s.name || `Schema ${idx + 1}`}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Columns list */}
      <div className="flex-1 overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50/30 text-gray-400 text-[10px] font-semibold tracking-wider border-b border-gray-100">
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Tipo Talend</th>
              <th className="px-4 py-3">Largo</th>
              <th className="px-4 py-3">Precisión</th>
              <th className="px-4 py-3">Nullable</th>
              <th className="px-4 py-3">Key</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 text-xs text-gray-700 font-mono">
            {columns.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400 text-xs">
                  Este esquema no tiene columnas definidas
                </td>
              </tr>
            ) : (
              columns.map((col, idx) => (
                <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3 font-semibold text-gray-800">
                    {col.name}
                  </td>
                  <td className="px-4 py-3 text-blue-900">
                    {col.type || "id_String"}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {col.length !== undefined ? col.length : "-"}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {col.precision !== undefined ? col.precision : "-"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                        col.nullable
                          ? "bg-gray-100 text-gray-500"
                          : "bg-blue-50 text-blue-700"
                      }`}
                    >
                      {col.nullable ? "Sí" : "No"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {col.key ? (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-100">
                        🔑 Key
                      </span>
                    ) : (
                      "-"
                    )}
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
