import { useState, useEffect, useCallback } from "react";
import { useCallTool } from "../../openai/useCallTool";
import { AppHeader, ErrorBanner, LoadingState, MetricCard } from "../../design-system";

interface PingData {
  ok?: boolean;
  plugin?: string;
  version?: string;
  mode?: string;
  unsafeActions?: boolean;
}

interface WorkspaceData {
  workspaceRoot?: string;
  projects?: Array<{ name: string; path: string; open: boolean }>;
}

interface ProblemsData {
  markers?: Array<{ severity: string; message: string }>;
}

interface CoverageData {
  overall?: number;
  areas?: Array<{ name: string; coverage: number }>;
}

interface SummaryMetrics {
  bridgeOk: boolean;
  pluginName: string;
  version: string;
  mode: string;
  unsafeActions: string;
  workspacePath: string;
  projectsOpen: number;
  problemErrors: number;
  problemWarnings: number;
  coverage: number;
}

export function EnvironmentDoctorApp() {
  const { execute: callTool } = useCallTool();

  const [metrics, setMetrics] = useState<SummaryMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [initialLoad, setInitialLoad] = useState(true);
  const [isRunning, setIsRunning] = useState(false);

  const runDiagnostics = useCallback(async () => {
    setIsRunning(true);
    setError(null);
    try {
      const [pingRaw, wsRaw, problemsRaw, coverageRaw] = await Promise.all([
        callTool("talend_bridge_ping", {}),
        callTool("talend_bridge_workspace_state", {}),
        callTool("talend_bridge_problems_markers", {}),
        callTool("talend_coverage_report", {}),
      ]);

      void callTool("talend_components_catalog_status", {});
      void callTool("talend_jobs_list", { limit: 50, offset: 0 });

      const pingData = pingRaw.ok ? (pingRaw.data as PingData) : undefined;
      const wsData = wsRaw.ok ? (wsRaw.data as WorkspaceData) : undefined;
      const problemsData = problemsRaw.ok ? (problemsRaw.data as ProblemsData) : undefined;
      const coverageData = coverageRaw.ok ? (coverageRaw.data as CoverageData) : undefined;

      const markers = Array.isArray(problemsData?.markers)
        ? problemsData.markers
        : [];

      setMetrics({
        bridgeOk: pingData?.ok === true,
        pluginName: pingData?.plugin ?? "-",
        version: pingData?.version ?? "-",
        mode: pingData?.mode ?? "-",
        unsafeActions: pingData?.unsafeActions ? "Habilitadas" : "Deshabilitadas",
        workspacePath: wsData?.workspaceRoot ?? "-",
        projectsOpen: Array.isArray(wsData?.projects)
          ? wsData.projects.filter((p) => p.open).length
          : 0,
        problemErrors: markers.filter((m) => m.severity === "ERROR").length,
        problemWarnings: markers.filter((m) => m.severity === "WARNING").length,
        coverage: coverageData?.overall ?? 0,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al ejecutar diagnostico");
    } finally {
      setInitialLoad(false);
      setIsRunning(false);
    }
  }, [callTool]);

  useEffect(() => { runDiagnostics(); }, [runDiagnostics]);

  if (initialLoad) {
    return <LoadingState message="Ejecutando diagnostico del entorno..." />;
  }

  return (
    <div className="space-y-6">
      <AppHeader
        title="Environment Doctor"
        subtitle="Diagnostico completo del entorno Talend"
        onRefresh={runDiagnostics}
        isLoading={isRunning}
      />

      <ErrorBanner message={error} onDismiss={() => setError(null)} />

      {metrics && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
            <MetricCard
              label="Bridge"
              value={metrics.bridgeOk ? "OK" : "ERROR"}
              variant={metrics.bridgeOk ? "success" : "error"}
            />
            <MetricCard
              label="Plugin"
              value={metrics.pluginName}
              variant="default"
            />
            <MetricCard
              label="Version"
              value={metrics.version}
              variant="default"
            />
            <MetricCard
              label="Mode"
              value={metrics.mode}
              variant="default"
            />
            <MetricCard
              label="Unsafe Actions"
              value={metrics.unsafeActions}
              variant={metrics.unsafeActions === "Habilitadas" ? "warning" : "success"}
            />
            <MetricCard
              label="Proyectos"
              value={metrics.projectsOpen}
              variant={metrics.projectsOpen > 0 ? "success" : "default"}
            />
            <MetricCard
              label="Errores"
              value={metrics.problemErrors}
              variant={metrics.problemErrors > 0 ? "error" : "success"}
            />
            <MetricCard
              label="Advertencias"
              value={metrics.problemWarnings}
              variant={metrics.problemWarnings > 0 ? "warning" : "default"}
            />
            <MetricCard
              label="Coverage"
              value={`${metrics.coverage}%`}
              variant="info"
            />
          </div>

          {metrics.workspacePath !== "-" && (
            <div className="bg-white rounded-lg border border-gray-200">
              <div className="px-4 py-3 border-b border-gray-200">
                <h3 className="text-sm font-semibold text-gray-900">Workspace</h3>
              </div>
              <div className="p-4">
                <p className="text-sm font-mono text-gray-600 break-all">{metrics.workspacePath}</p>
              </div>
            </div>
          )}

          <div className="bg-white rounded-lg border border-gray-200">
            <div className="px-4 py-3 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900">Acciones Recomendadas</h3>
            </div>
            <div className="divide-y divide-gray-100">
              {[
                {
                  num: 1,
                  title: "Configurar codificacion UTF-8 en proyectos",
                  desc: "Asegurar que todos los proyectos usen codificacion UTF-8 para evitar problemas de caracteres especiales.",
                },
                {
                  num: 2,
                  title: "Revisar Maven archiver error en pom.xml",
                  desc: "El archivo pom.xml muestra errores relacionados con Maven archiver que deben ser revisados.",
                },
                {
                  num: 3,
                  title: "Ejecutar scan de componentes",
                  desc: "Realizar un escaneo completo de componentes para asegurar que el catalogo este actualizado.",
                },
                {
                  num: 4,
                  title: "Mejorar execution tracking",
                  desc: "Implementar un mejor seguimiento de ejecuciones para identificar cuellos de botella.",
                },
              ].map((item) => (
                <div key={item.num} className="px-4 py-3 flex items-start gap-3">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-100 text-amber-700 text-xs font-medium flex items-center justify-center mt-0.5">
                    {item.num}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{item.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
