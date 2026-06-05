import { MetricCard } from "../../design-system/MetricCard";

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
        label="Runtime OS"
        value={workspace.runtimeOs ?? "—"}
        variant="default"
      />
      <MetricCard
        label="Path Mode"
        value={workspace.pathMode ?? "—"}
        variant="default"
        sublabel={workspace.talendHostOs ?? ""}
      />
    </div>
  );
}
