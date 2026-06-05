import type { ActiveComponentDetails } from "../types";

interface ComponentDetailsPanelProps {
  details: ActiveComponentDetails;
  onSelectInStudio: () => void;
  onRenameLabel: () => void;
  onRenameUniqueName: () => void;
  isSelecting: boolean;
}

export function ComponentDetailsPanel({
  details,
  onSelectInStudio,
  onRenameLabel,
  onRenameUniqueName,
  isSelecting,
}: ComponentDetailsPanelProps) {
  const { component } = details;

  // Calculate some simple insights based on parameters
  const getInsights = () => {
    const insights: Array<{ title: string; desc: string; type: "warning" | "info" | "success" }> = [];
    const name = component.componentName;

    // Detect CSV Options
    if (name === "tFileInputDelimited") {
      const filename = component.parameters.find((p) => p.name === "FILENAME")?.value || "";
      if (filename && !filename.includes("context.")) {
        insights.push({
          title: "Ruta de archivo estática",
          desc: "La ruta del archivo CSV es fija. Considera parametrizarla usando variables de contexto (context.xxx).",
          type: "warning",
        });
      } else {
        insights.push({
          title: "Ruta parametrizada",
          desc: "La ruta del archivo CSV utiliza variables de contexto, facilitando la portabilidad entre entornos.",
          type: "success",
        });
      }
    }

    // Detect DB details
    if (name.includes("Output") || name.includes("Input") && (name.includes("JDBC") || name.includes("DB") || name.includes("Postgres") || name.includes("Mysql"))) {
      const table = component.parameters.find((p) => p.name === "TABLE")?.value || "";
      const tableAction = component.parameters.find((p) => p.name === "TABLE_ACTION")?.value || "";
      
      if (tableAction === "DROP_CREATE" || tableAction === "CLEAR") {
        insights.push({
          title: "Acción de tabla destructiva",
          desc: `El componente está configurado para '${tableAction}' en la tabla '${table || 'destino'}'. Esto eliminará datos al ejecutarse.`,
          type: "warning",
        });
      }
    }

    // Context usage count
    const contextParams = component.parameters.filter((p) => p.value && p.value.includes("context."));
    if (contextParams.length > 0) {
      insights.push({
        title: "Uso de contexto",
        desc: `Este componente lee ${contextParams.length} parámetro(s) a través de variables de contexto.`,
        type: "info",
      });
    }

    return insights;
  };

  const insights = getInsights();

  // Determine global risk level
  const getRiskLevel = () => {
    if (insights.some((i) => i.type === "warning")) return { label: "Alto", color: "bg-red-50 text-red-700 border-red-100" };
    if (component.componentName.includes("Output")) return { label: "Medio", color: "bg-amber-50 text-amber-700 border-amber-100" };
    return { label: "Bajo", color: "bg-green-50 text-green-700 border-green-100" };
  };

  const risk = getRiskLevel();

  return (
    <div className="space-y-6">
      {/* Identity Card */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <h2 className="text-lg font-semibold text-gray-800">{component.label || component.uniqueName}</h2>
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${risk.color}`}>
              Riesgo: {risk.label}
            </span>
          </div>
          <p className="text-xs text-gray-500 font-mono">
            {component.uniqueName} • {component.componentName}
          </p>
          <p className="text-[10px] text-gray-400">
            Java: {component.className}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={onSelectInStudio}
            disabled={isSelecting}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition-all shadow-sm shadow-blue-500/10 flex items-center space-x-1 disabled:opacity-50"
          >
            {isSelecting ? (
              <span>Seleccionando...</span>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                <span>Ver en Studio</span>
              </>
            )}
          </button>
          
          <button
            onClick={onRenameLabel}
            className="px-3 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-lg text-xs font-medium border border-gray-200 transition-all flex items-center space-x-1"
          >
            <svg className="w-3.5 h-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <span>Renombrar Label</span>
          </button>

          <button
            onClick={onRenameUniqueName}
            className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100/70 text-amber-800 rounded-lg text-xs font-medium border border-amber-200/50 transition-all flex items-center space-x-1"
          >
            <svg className="w-3.5 h-3.5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>Cambiar ID (UniqueName)</span>
          </button>
        </div>
      </div>

      {/* Audit & Insights */}
      {insights.length > 0 && (
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-3">
          <h3 className="font-semibold text-gray-800 text-sm">Auditoría del Componente</h3>
          <div className="space-y-3">
            {insights.map((item, idx) => (
              <div
                key={idx}
                className={`p-3.5 rounded-xl border flex items-start space-x-3 text-xs ${
                  item.type === "warning"
                    ? "bg-red-50/50 border-red-100 text-red-900"
                    : item.type === "success"
                    ? "bg-green-50/50 border-green-100 text-green-900"
                    : "bg-blue-50/50 border-blue-100 text-blue-900"
                }`}
              >
                <div className="mt-0.5">
                  {item.type === "warning" ? (
                    <svg className="w-4 h-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  ) : item.type === "success" ? (
                    <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                </div>
                <div className="space-y-0.5">
                  <h4 className="font-semibold">{item.title}</h4>
                  <p className="text-gray-500 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
