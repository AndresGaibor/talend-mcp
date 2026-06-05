interface TMapEntry {
  name: string;
  expression?: string;
}

interface TMapTable {
  name: string;
  entries: TMapEntry[];
}

interface TMapData {
  inputTables?: TMapTable[];
  outputTables?: TMapTable[];
  varTables?: TMapTable[];
  error?: string;
}

interface TMapInspectorProps {
  tMapData: TMapData;
}

export function TMapInspector({ tMapData }: TMapInspectorProps) {
  if (tMapData.error) {
    return (
      <div className="bg-red-50 p-4 border border-red-100 rounded-xl text-xs text-red-800">
        Error al extraer datos de tMap: {tMapData.error}
      </div>
    );
  }

  const inputs = tMapData.inputTables || [];
  const outputs = tMapData.outputTables || [];
  const vars = tMapData.varTables || [];

  return (
    <div className="space-y-6">
      {/* Overview stats */}
      <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between text-xs text-gray-500">
        <div>Tablas de Entrada: <span className="font-semibold text-gray-800">{inputs.length}</span></div>
        <div>Tablas de Salida: <span className="font-semibold text-gray-800">{outputs.length}</span></div>
        <div>Variables locales: <span className="font-semibold text-gray-800">{vars.length}</span></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Left Side: Inputs */}
        <div className="space-y-4">
          <h4 className="font-semibold text-xs text-gray-500 uppercase tracking-wider">Tablas de Entrada (Sources)</h4>
          {inputs.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 text-gray-400 text-xs rounded-xl border border-gray-100">
              No hay tablas de entrada registradas
            </div>
          ) : (
            inputs.map((table, tIdx) => (
              <div key={tIdx} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="bg-blue-50/50 px-4 py-2 border-b border-gray-100 flex justify-between items-center">
                  <span className="font-semibold text-xs text-blue-900 font-mono">{table.name}</span>
                  <span className="text-[10px] text-blue-700 bg-blue-100/30 px-2 py-0.5 rounded font-medium">
                    {table.entries.length} columnas
                  </span>
                </div>
                <div className="divide-y divide-gray-50 max-h-60 overflow-y-auto">
                  {table.entries.map((entry, eIdx) => (
                    <div key={eIdx} className="p-3 text-xs flex justify-between gap-4 hover:bg-gray-50/30">
                      <span className="font-medium text-gray-700 font-mono">{entry.name}</span>
                      <span className="text-gray-400 font-mono text-[10px] truncate max-w-xs">{entry.expression || "-"}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Right Side: Outputs & Variables */}
        <div className="space-y-6">
          
          {/* Outputs */}
          <div className="space-y-4">
            <h4 className="font-semibold text-xs text-gray-500 uppercase tracking-wider">Tablas de Salida (Targets)</h4>
            {outputs.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 text-gray-400 text-xs rounded-xl border border-gray-100">
                No hay tablas de salida registradas
              </div>
            ) : (
              outputs.map((table, tIdx) => (
                <div key={tIdx} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="bg-green-50/50 px-4 py-2 border-b border-gray-100 flex justify-between items-center">
                    <span className="font-semibold text-xs text-green-900 font-mono">{table.name}</span>
                    <span className="text-[10px] text-green-700 bg-green-100/30 px-2 py-0.5 rounded font-medium">
                      {table.entries.length} mappings
                    </span>
                  </div>
                  <div className="divide-y divide-gray-50 max-h-60 overflow-y-auto">
                    {table.entries.map((entry, eIdx) => {
                      const isUnmapped = !entry.expression || entry.expression.trim() === "";
                      return (
                        <div key={eIdx} className="p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-gray-50/30">
                          <div className="flex items-center space-x-2">
                            <span className="font-medium text-gray-700 font-mono">{entry.name}</span>
                            {isUnmapped && (
                              <span className="text-[9px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded font-bold border border-red-100">
                                Sin expresión
                              </span>
                            )}
                          </div>
                          <span className={`font-mono text-[10px] max-w-xs break-all sm:text-right ${
                            isUnmapped ? "text-red-400 italic" : "text-blue-900 bg-blue-50/30 px-2 py-0.5 rounded border border-blue-100/30"
                          }`}>
                            {entry.expression || "empty / unmapped"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Variables */}
          {vars.length > 0 && (
            <div className="space-y-4">
              <h4 className="font-semibold text-xs text-gray-500 uppercase tracking-wider">Variables Locales (Vars)</h4>
              {vars.map((table, tIdx) => (
                <div key={tIdx} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="bg-purple-50/50 px-4 py-2 border-b border-gray-100 flex justify-between items-center">
                    <span className="font-semibold text-xs text-purple-900 font-mono">{table.name}</span>
                    <span className="text-[10px] text-purple-700 bg-purple-100/30 px-2 py-0.5 rounded font-medium">
                      {table.entries.length} vars
                    </span>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {table.entries.map((entry, eIdx) => (
                      <div key={eIdx} className="p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-gray-50/30">
                        <span className="font-medium text-gray-700 font-mono">{entry.name}</span>
                        <span className="font-mono text-[10px] text-purple-900 bg-purple-50/30 px-2 py-0.5 rounded border border-purple-100/30 break-all sm:text-right">
                          {entry.expression || <span className="text-gray-300 italic">sin expresión</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
