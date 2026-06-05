import { MetricCard } from "../../design-system/MetricCard";

interface BridgeStatus {
  connected: boolean;
  studioRunning: boolean;
  lastPing?: string;
}

interface WorkspaceState {
  workspaceRoot?: string;
  projects?: Array<{ name: string; path: string; open: boolean }>;
}

interface HomeStatusCardsProps {
  bridgeStatus: BridgeStatus;
  workspace: WorkspaceState;
  jobsCount: number;
  problemsCount: number;
}

export function HomeStatusCards({
  bridgeStatus,
  workspace,
  jobsCount,
  problemsCount,
}: HomeStatusCardsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      <MetricCard
        label="Bridge"
        value={bridgeStatus.connected ? "Conectado" : "Desconectado"}
        variant={bridgeStatus.connected ? "success" : "error"}
        sublabel={bridgeStatus.lastPing
          ? `Ultimo ping: ${new Date(bridgeStatus.lastPing).toLocaleTimeString()}`
          : undefined}
      />
      <MetricCard
        label="Studio"
        value={bridgeStatus.studioRunning ? "Activo" : "Detenido"}
        variant={bridgeStatus.studioRunning ? "success" : "warning"}
      />
      <MetricCard
        label="Jobs"
        value={jobsCount}
        variant="info"
      />
      <MetricCard
        label="Problemas"
        value={problemsCount}
        variant={problemsCount > 0 ? "error" : "default"}
        sublabel={problemsCount > 0 ? "Requieren atencion" : "Sin problemas"}
      />
      <MetricCard
        label="Workspace"
        value={workspace.workspaceRoot ? "Configurado" : "—"}
        variant={workspace.workspaceRoot ? "success" : "default"}
        sublabel={workspace.workspaceRoot?.split("/").pop() ?? ""}
      />
      <MetricCard
        label="Proyectos"
        value={Array.isArray(workspace.projects) ? workspace.projects.length : 0}
        variant="default"
        sublabel={workspace.projects ? `${workspace.projects.filter(p => p.open).length} abiertos` : ""}
      />
    </div>
  );
}
