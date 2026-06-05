import { useState, useEffect, useCallback } from "react";
import { useCallTool } from "../../openai/useCallTool";
import { AppHeader, ErrorBanner, LoadingState } from "../../design-system";
import { HomeStatusCards } from "./HomeStatusCards";
import { HomeQuickActions } from "./HomeQuickActions";

interface BridgeStatus {
  connected: boolean;
  studioRunning: boolean;
  lastPing?: string;
}

interface WorkspaceState {
  runtimeOs?: string;
  talendHostOs?: string;
  pathMode?: string;
  projectPath?: string;
  workspace?: string;
}

interface JobsInfo {
  count: number;
  jobs: Array<{ name: string; status: string }>;
}

interface ProblemsInfo {
  count: number;
  problems: Array<{ severity: string; message: string }>;
}

export function HomeApp() {
  const { execute: callTool, isLoading } = useCallTool();

  const [bridgeStatus, setBridgeStatus] = useState<BridgeStatus>({ connected: false, studioRunning: false });
  const [workspace, setWorkspace] = useState<WorkspaceState>({});
  const [jobsInfo, setJobsInfo] = useState<JobsInfo>({ count: 0, jobs: [] });
  const [problemsInfo, setProblemsInfo] = useState<ProblemsInfo>({ count: 0, problems: [] });
  const [error, setError] = useState<string | null>(null);
  const [initialLoad, setInitialLoad] = useState(true);

  const loadAll = useCallback(async () => {
    setError(null);
    try {
      const [bridgeRaw, wsRaw, jobsRaw, problemsRaw] = await Promise.all([
        callTool("talend_bridge_ping", {}),
        callTool("talend_bridge_workspace_state", {}),
        callTool("talend_jobs_list", { limit: 100 }),
        callTool("talend_bridge_problems_markers", {}),
      ]);

      if (bridgeRaw.success && bridgeRaw.result) {
        try {
          const data = JSON.parse(bridgeRaw.result);
          setBridgeStatus({
            connected: true,
            studioRunning: data.studioRunning ?? false,
            lastPing: new Date().toISOString(),
          });
        } catch {
          setBridgeStatus({ connected: true, studioRunning: false });
        }
      } else {
        setBridgeStatus({ connected: false, studioRunning: false });
        setError("No se pudo conectar al bridge de Talend Studio");
      }

      if (wsRaw.success && wsRaw.result) {
        try {
          const data = JSON.parse(wsRaw.result);
          setWorkspace({
            runtimeOs: data.runtimeOs,
            talendHostOs: data.talendHostOs,
            pathMode: data.pathMode,
            projectPath: data.projectPath,
            workspace: data.workspace,
          });
        } catch { /* ignore parse errors */ }
      }

      if (jobsRaw.success && jobsRaw.result) {
        try {
          const data = JSON.parse(jobsRaw.result);
          const jobs = Array.isArray(data) ? data : data.jobs ?? [];
          setJobsInfo({ count: jobs.length, jobs: jobs.slice(0, 10) });
        } catch { setJobsInfo({ count: 0, jobs: [] }); }
      }

      if (problemsRaw.success && problemsRaw.result) {
        try {
          const data = JSON.parse(problemsRaw.result);
          const problems = Array.isArray(data) ? data : data.problems ?? [];
          setProblemsInfo({ count: problems.length, problems: problems.slice(0, 10) });
        } catch { setProblemsInfo({ count: 0, problems: [] }); }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar datos");
    } finally {
      setInitialLoad(false);
    }
  }, [callTool]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleAction = useCallback(async (toolName: string, args: Record<string, unknown>) => {
    await callTool(toolName, args);
  }, [callTool]);

  const handleNavigate = useCallback((appId: string) => {
    const metaTag = document.querySelector('meta[name="app-id"]');
    if (metaTag) {
      metaTag.setAttribute("content", appId);
      window.location.reload();
    }
  }, []);

  if (initialLoad) {
    return <LoadingState message="Cargando estado del entorno..." />;
  }

  return (
    <div className="space-y-6">
      <AppHeader
        title="Talend MCP"
        subtitle="Resumen del estado del entorno y acceso rapido"
        onRefresh={loadAll}
        isLoading={isLoading}
      />

      <ErrorBanner message={error} onDismiss={() => setError(null)} />

      <HomeStatusCards
        bridgeStatus={bridgeStatus}
        workspace={workspace}
        jobsCount={jobsInfo.count}
        problemsCount={problemsInfo.count}
      />

      {workspace.projectPath && (
        <div className="bg-white rounded-lg border border-gray-200 px-4 py-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-400 font-medium">Proyecto:</span>
            <code className="text-gray-700 font-mono text-xs">{workspace.projectPath}</code>
            {workspace.workspace && (
              <>
                <span className="text-gray-300 mx-1">|</span>
                <span className="text-gray-400 font-medium">Workspace:</span>
                <code className="text-gray-700 font-mono text-xs">{workspace.workspace}</code>
              </>
            )}
          </div>
        </div>
      )}

      <HomeQuickActions onNavigate={handleNavigate} onAction={handleAction} />

      {jobsInfo.jobs.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-4 py-3 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-900">Jobs Recientes</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {jobsInfo.jobs.slice(0, 5).map((job, i) => (
              <div key={i} className="px-4 py-2.5 flex items-center justify-between text-sm">
                <span className="text-gray-700 font-mono text-xs">{job.name}</span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  job.status === "production"
                    ? "bg-emerald-50 text-emerald-700"
                    : job.status === "development"
                    ? "bg-sky-50 text-sky-700"
                    : "bg-gray-50 text-gray-600"
                }`}>
                  {job.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {problemsInfo.problems.length > 0 && (
        <div className="bg-white rounded-lg border border-amber-200">
          <div className="px-4 py-3 border-b border-amber-200">
            <h3 className="text-sm font-semibold text-amber-800">Problemas Detectados ({problemsInfo.count})</h3>
          </div>
          <div className="divide-y divide-amber-100">
            {problemsInfo.problems.slice(0, 5).map((p, i) => (
              <div key={i} className="px-4 py-2.5 flex items-start gap-2 text-sm">
                <span className={`text-xs font-medium mt-0.5 ${
                  p.severity === "error" ? "text-red-500" :
                  p.severity === "warning" ? "text-amber-500" : "text-gray-400"
                }`}>
                  {p.severity === "error" ? "!" : p.severity === "warning" ? "?" : "i"}
                </span>
                <span className="text-gray-600 text-xs">{p.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
