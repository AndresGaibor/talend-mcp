import { useState, useEffect, useCallback } from "react";
import { useCallTool } from "../../openai/useCallTool";
import { Card } from "../../components/Card";
import { Badge } from "../../components/Badge";
import type { ComponentInfo, ComponentDetails, ComponentParameter, ComponentConnector } from "./types";

interface ComponentDetailsPanelProps {
  component: ComponentInfo;
}

export function ComponentDetails({ component }: ComponentDetailsPanelProps) {
  const { execute: callTool, isLoading } = useCallTool();
  const [details, setDetails] = useState<ComponentDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"parameters" | "connectors">("parameters");

  const loadDetails = useCallback(async () => {
    setError(null);
    setDetails(null);

    const result = await callTool("talend_components_inspect", {
      family: component.family,
      name: component.name,
    });

    if (result.success && result.result) {
      try {
        const data = JSON.parse(result.result);
        if (data.ok) {
          setDetails(data.component || data);
        } else {
          setError(data.error?.message || "Inspección falló");
        }
      } catch {
        setError("Error parseando respuesta");
      }
    } else {
      setError(result.error || "Error en inspección");
    }
  }, [component, callTool]);

  useEffect(() => {
    loadDetails();
  }, [loadDetails]);

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{component.name}</h3>
          <p className="text-sm text-gray-500">
            {component.family} {component.version && `• v${component.version}`}
          </p>
        </div>
        <button
          onClick={loadDetails}
          disabled={isLoading}
          className="text-sm text-blue-600 hover:text-blue-700 disabled:opacity-50"
        >
          {isLoading ? "Cargando..." : "Refrescar"}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-md mb-4">
          {error}
        </div>
      )}

      {details?.description && (
        <p className="text-gray-600 mb-4">{details.description}</p>
      )}

      <div className="border-b border-gray-200 mb-4">
        <nav className="flex gap-4">
          <button
            onClick={() => setActiveTab("parameters")}
            className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "parameters"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Parámetros
          </button>
          <button
            onClick={() => setActiveTab("connectors")}
            className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "connectors"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Conectores
          </button>
        </nav>
      </div>

      {!details && !error && (
        <div className="text-center py-8 text-gray-500">
          {isLoading ? "Cargando detalles..." : "Selecciona un componente para ver detalles"}
        </div>
      )}

      {activeTab === "parameters" && details?.parameters && (
        <ParametersTable parameters={details.parameters} />
      )}

      {activeTab === "connectors" && details?.connectors && (
        <ConnectorsTable connectors={details.connectors} />
      )}

      {activeTab === "parameters" && (!details?.parameters || details.parameters.length === 0) && details && (
        <p className="text-gray-500 text-center py-4">No hay parámetros disponibles</p>
      )}

      {activeTab === "connectors" && (!details?.connectors || details.connectors.length === 0) && details && (
        <p className="text-gray-500 text-center py-4">No hay conectores disponibles</p>
      )}
    </Card>
  );
}

function ParametersTable({ parameters }: { parameters: ComponentParameter[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Requerido</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Default</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {parameters.map((param, idx) => (
            <tr key={`${param.name}-${idx}`} className="hover:bg-gray-50">
              <td className="px-3 py-2">
                <span className="font-medium text-gray-900">{param.name}</span>
                {param.label && <span className="text-gray-400 ml-2">({param.label})</span>}
              </td>
              <td className="px-3 py-2 text-sm text-gray-600">{param.type || "string"}</td>
              <td className="px-3 py-2">
                {param.required ? (
                  <Badge variant="error">Sí</Badge>
                ) : (
                  <Badge variant="default">No</Badge>
                )}
              </td>
              <td className="px-3 py-2 text-sm text-gray-500">
                {param.defaultValue !== undefined ? String(param.defaultValue) : "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ConnectorsTable({ connectors }: { connectors: ComponentConnector[] }) {
  return (
    <div className="space-y-2">
      {connectors.map((connector, idx) => (
        <div
          key={`${connector.name}-${idx}`}
          className="flex items-center justify-between p-3 border border-gray-200 rounded-md"
        >
          <div>
            <span className="font-medium text-gray-900">{connector.name}</span>
            {connector.description && (
              <p className="text-sm text-gray-500 mt-1">{connector.description}</p>
            )}
          </div>
          <Badge variant={connector.type === "INPUT" ? "info" : connector.type === "OUTPUT" ? "success" : "default"}>
            {connector.type}
          </Badge>
        </div>
      ))}
    </div>
  );
}
