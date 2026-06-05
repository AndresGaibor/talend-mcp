import { useState, useEffect, useCallback } from "react";
import { useCallTool } from "../../openai/useCallTool";
import { AppHeader, ErrorBanner, LoadingState } from "../../design-system";
import { Button } from "../../components/Button";

interface Marker {
  severity: string;
  resource: string;
  line: number;
  message: string;
  type: string;
}

type FilterState = "all" | "errors" | "warnings";

export function ProblemsViewApp() {
  const { execute: callTool, isLoading } = useCallTool();
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [initialLoad, setInitialLoad] = useState(true);
  const [filter, setFilter] = useState<FilterState>("all");
  const [explainResult, setExplainResult] = useState<{ message: string; result: string } | null>(null);

  const loadMarkers = useCallback(async () => {
    setError(null);
    try {
      const result = await callTool("talend_bridge_problems_markers", {});

      if (result.ok && result.data) {
        const data = result.data as any;
        if (Array.isArray(data.markers)) {
          setMarkers(data.markers);
        } else if (Array.isArray(data)) {
          setMarkers(data);
        } else {
          setMarkers([]);
        }
      } else if (result.result) {
        try {
          const parsed = JSON.parse(result.result);
          if (Array.isArray(parsed.markers)) {
            setMarkers(parsed.markers);
          } else if (Array.isArray(parsed)) {
            setMarkers(parsed);
          } else {
            setMarkers([]);
          }
        } catch {
          setMarkers([]);
        }
      } else {
        setError(result.error || "Error al cargar problemas");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setInitialLoad(false);
    }
  }, [callTool]);

  useEffect(() => { loadMarkers(); }, [loadMarkers]);

  const handleExplain = useCallback(async (message: string) => {
    const result = await callTool("talend_errors_explain", { errorMessage: message });
    if (result.ok && result.data) {
      const data = result.data as any;
      setExplainResult({
        message,
        result: data.explanation || data.result || JSON.stringify(data),
      });
    } else {
      setExplainResult({
        message,
        result: result.error || "No se pudo explicar el error",
      });
    }
  }, [callTool]);

  const handleCopy = useCallback(async (message: string) => {
    try {
      await navigator.clipboard.writeText(message);
    } catch {
      // fallback
    }
  }, []);

  const filteredMarkers = markers.filter((m) => {
    if (filter === "errors") return m.severity === "Error";
    if (filter === "warnings") return m.severity === "Warning";
    return true;
  });

  const errorCount = markers.filter((m) => m.severity === "Error").length;
  const warningCount = markers.filter((m) => m.severity === "Warning").length;
  const infoCount = markers.filter((m) => m.severity === "Info").length;

  if (initialLoad) {
    return <LoadingState message="Cargando problemas..." />;
  }

  return (
    <div className="space-y-6">
      <AppHeader
        title="Problems View"
        subtitle="Vista centralizada de problemas, warnings y errores"
        onRefresh={loadMarkers}
        isLoading={isLoading}
      />

      <ErrorBanner message={error} onDismiss={() => setError(null)} />

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Errores</p>
          <p className="text-2xl font-bold mt-1 text-red-700">{errorCount}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Warnings</p>
          <p className="text-2xl font-bold mt-1 text-amber-700">{warningCount}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Info</p>
          <p className="text-2xl font-bold mt-1 text-sky-700">{infoCount}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant={filter === "all" ? "primary" : "outline"}
          onClick={() => setFilter("all")}
          size="sm"
        >
          All ({markers.length})
        </Button>
        <Button
          variant={filter === "errors" ? "primary" : "outline"}
          onClick={() => setFilter("errors")}
          size="sm"
        >
          Errors ({errorCount})
        </Button>
        <Button
          variant={filter === "warnings" ? "primary" : "outline"}
          onClick={() => setFilter("warnings")}
          size="sm"
        >
          Warnings ({warningCount})
        </Button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {filteredMarkers.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm">
            No se encontraron problemas
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase">Severidad</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase">Recurso</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase">Línea</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase">Mensaje</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase">Tipo</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-gray-500 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredMarkers.map((marker, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-4 py-2">
                    <SeverityBadge severity={marker.severity} />
                  </td>
                  <td className="px-4 py-2 text-gray-700 font-mono text-xs max-w-[200px] truncate" title={marker.resource}>
                    {marker.resource}
                  </td>
                  <td className="px-4 py-2 text-gray-700">{marker.line}</td>
                  <td className="px-4 py-2 text-gray-700 max-w-[300px] truncate" title={marker.message}>
                    {marker.message}
                  </td>
                  <td className="px-4 py-2 text-gray-500">{marker.type}</td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {marker.severity === "Error" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleExplain(marker.message)}
                        >
                          Explicar error
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopy(marker.message)}
                      >
                        Copiar
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {explainResult && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setExplainResult(null)}>
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Explicación del Error</h3>
              <button onClick={() => setExplainResult(null)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
            </div>
            <div className="px-4 py-3 overflow-y-auto flex-1 space-y-3">
              <div className="bg-gray-50 p-2 rounded">
                <p className="text-xs text-gray-400 font-mono break-words">{explainResult.message}</p>
              </div>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{explainResult.result}</p>
            </div>
            <div className="px-4 py-3 border-t border-gray-200 flex justify-end">
              <Button variant="outline" onClick={() => setExplainResult(null)}>Cerrar</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    Error: "bg-red-100 text-red-700",
    Warning: "bg-amber-100 text-amber-700",
    Info: "bg-sky-100 text-sky-700",
  };
  return (
    <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${colors[severity] || "bg-gray-100 text-gray-700"}`}>
      {severity}
    </span>
  );
}
