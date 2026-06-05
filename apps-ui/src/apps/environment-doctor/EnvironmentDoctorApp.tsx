import { useState, useEffect, useCallback } from "react";
import { useCallTool } from "../../openai/useCallTool";
import { AppHeader, ErrorBanner, LoadingState, MetricCard } from "../../design-system";

interface HealthCheck {
  name: string;
  status: "ok" | "warning" | "error";
  message: string;
  details?: string;
}

interface EnvInfo {
  talendVersion?: string;
  javaVersion?: string;
  nodeVersion?: string;
  osInfo?: string;
  workspacePath?: string;
  studioVersion?: string;
}

export function EnvironmentDoctorApp() {
  const { execute: callTool, isLoading } = useCallTool();

  const [checks, setChecks] = useState<HealthCheck[]>([]);
  const [envInfo, setEnvInfo] = useState<EnvInfo>({});
  const [error, setError] = useState<string | null>(null);
  const [initialLoad, setInitialLoad] = useState(true);

  const runDiagnostics = useCallback(async () => {
    setError(null);
    try {
      const [bridgeRaw, envRaw, wsRaw] = await Promise.all([
        callTool("talend_bridge_ping", {}),
        callTool("talend_bridge_environment_variables", {}),
        callTool("talend_bridge_workspace_state", {}),
      ]);

      const results: HealthCheck[] = [];

      if (bridgeRaw.success && bridgeRaw.result) {
        try {
          const data = JSON.parse(bridgeRaw.result);
          results.push({
            name: "Conexion Bridge",
            status: data.connected ? "ok" : "error",
            message: data.connected ? "Bridge conectado correctamente" : "Bridge no responde",
            details: data.studioRunning ? "Studio activo" : "Studio detenido",
          });
        } catch {
          results.push({
            name: "Conexion Bridge",
            status: "error",
            message: "Respuesta del bridge invalida",
          });
        }
      } else {
        results.push({
          name: "Conexion Bridge",
          status: "error",
          message: bridgeRaw.error || "No se pudo conectar al bridge",
        });
      }

      if (wsRaw.success && wsRaw.result) {
        try {
          const data = JSON.parse(wsRaw.result);
          results.push({
            name: "Espacio de Trabajo",
            status: data.projectPath ? "ok" : "warning",
            message: data.projectPath
              ? `Proyecto: ${data.projectPath.split("/").pop() || data.projectPath}`
              : "No se detecto proyecto activo",
            details: data.workspace,
          });

          setEnvInfo({
            talendVersion: data.talendVersion,
            javaVersion: data.javaVersion,
            nodeVersion: process.version,
            osInfo: `${data.runtimeOs ?? "?"} / ${data.talendHostOs ?? "?"}`,
            workspacePath: data.workspace,
            studioVersion: data.studioVersion,
          });
        } catch {
          results.push({
            name: "Espacio de Trabajo",
            status: "warning",
            message: "No se pudo leer informacion del workspace",
          });
        }
      }

      if (envRaw.success && envRaw.result) {
        results.push({
          name: "Variables de Entorno",
          status: "ok",
          message: "Variables de entorno accesibles",
        });
      } else {
        results.push({
          name: "Variables de Entorno",
          status: "warning",
          message: envRaw.error || "No se pudieron leer variables de entorno",
        });
      }

      setChecks(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al ejecutar diagnostico");
    } finally {
      setInitialLoad(false);
    }
  }, [callTool]);

  useEffect(() => { runDiagnostics(); }, [runDiagnostics]);

  const okCount = checks.filter((c) => c.status === "ok").length;
  const warnCount = checks.filter((c) => c.status === "warning").length;
  const errCount = checks.filter((c) => c.status === "error").length;
  const totalHealth = errCount > 0 ? "warning" as const : warnCount > 0 ? "warning" as const : "success" as const;

  if (initialLoad) {
    return <LoadingState message="Ejecutando diagnostico del entorno..." />;
  }

  return (
    <div className="space-y-6">
      <AppHeader
        title="Environment Doctor"
        subtitle="Diagnostico completo del entorno Talend"
        onRefresh={runDiagnostics}
        isLoading={isLoading}
      />

      <ErrorBanner message={error} onDismiss={() => setError(null)} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Total Checks"
          value={checks.length}
          variant={totalHealth}
        />
        <MetricCard
          label="Correctos"
          value={okCount}
          variant="success"
        />
        <MetricCard
          label="Advertencias"
          value={warnCount}
          variant="warning"
        />
        <MetricCard
          label="Errores"
          value={errCount}
          variant={errCount > 0 ? "error" : "default"}
        />
      </div>

      {envInfo.talendVersion && (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-4 py-3 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-900">Informacion del Entorno</h3>
          </div>
          <div className="p-4">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-400">Talend Version</dt>
                <dd className="text-gray-700 font-mono text-xs">{envInfo.talendVersion}</dd>
              </div>
              {envInfo.studioVersion && (
                <div className="flex justify-between">
                  <dt className="text-gray-400">Studio Version</dt>
                  <dd className="text-gray-700 font-mono text-xs">{envInfo.studioVersion}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-gray-400">Node</dt>
                <dd className="text-gray-700 font-mono text-xs">{envInfo.nodeVersion}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-400">OS</dt>
                <dd className="text-gray-700 font-mono text-xs">{envInfo.osInfo}</dd>
              </div>
              {envInfo.workspacePath && (
                <div className="flex justify-between col-span-2">
                  <dt className="text-gray-400">Workspace</dt>
                  <dd className="text-gray-700 font-mono text-xs truncate max-w-md">{envInfo.workspacePath}</dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-4 py-3 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900">Resultados del Diagnostico</h3>
        </div>
        <div className="divide-y divide-gray-100">
          {checks.map((check, i) => (
            <div key={i} className="px-4 py-3 flex items-start gap-3">
              <span className={`flex-shrink-0 w-2 h-2 mt-1.5 rounded-full ${
                check.status === "ok" ? "bg-emerald-400" :
                check.status === "warning" ? "bg-amber-400" : "bg-red-400"
              }`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">{check.name}</span>
                  <span className={`text-xs font-medium ${
                    check.status === "ok" ? "text-emerald-600" :
                    check.status === "warning" ? "text-amber-600" : "text-red-600"
                  }`}>
                    {check.status === "ok" ? "OK" : check.status === "warning" ? "Advertencia" : "Error"}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{check.message}</p>
                {check.details && (
                  <p className="text-xs text-gray-400 mt-0.5">{check.details}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
