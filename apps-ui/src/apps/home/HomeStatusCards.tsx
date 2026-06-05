import { Card } from "../../components/Card";
import { Badge } from "../../components/Badge";

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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Bridge Status</p>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={bridgeStatus.connected ? "success" : "error"}>
                {bridgeStatus.connected ? "Connected" : "Disconnected"}
              </Badge>
            </div>
          </div>
          <span className="text-2xl">🌉</span>
        </div>
        {bridgeStatus.lastPing && (
          <p className="text-xs text-gray-400 mt-2">
            Last ping: {new Date(bridgeStatus.lastPing).toLocaleTimeString()}
          </p>
        )}
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Studio Status</p>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={bridgeStatus.studioRunning ? "success" : "warning"}>
                {bridgeStatus.studioRunning ? "Running" : "Stopped"}
              </Badge>
            </div>
          </div>
          <span className="text-2xl">🎨</span>
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Environment</p>
            <p className="font-medium text-gray-900 mt-1">
              {workspace.runtimeOs ?? "—"} / {workspace.talendHostOs ?? "—"}
            </p>
          </div>
          <span className="text-2xl">🖥️</span>
        </div>
        {workspace.pathMode && (
          <p className="text-xs text-gray-400 mt-2">Path mode: {workspace.pathMode}</p>
        )}
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Project</p>
            <p className="font-medium text-gray-900 mt-1 truncate" title={workspace.projectPath}>
              {workspace.projectPath ? workspace.projectPath.split("/").pop() : "—"}
            </p>
          </div>
          <span className="text-2xl">📁</span>
        </div>
        {workspace.workspace && (
          <p className="text-xs text-gray-400 mt-2 truncate" title={workspace.workspace}>
            WS: {workspace.workspace}
          </p>
        )}
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Jobs</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{jobsCount}</p>
          </div>
          <span className="text-2xl">⚙️</span>
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Problems</p>
            <p className={`text-2xl font-bold mt-1 ${problemsCount > 0 ? "text-red-600" : "text-gray-900"}`}>
              {problemsCount}
            </p>
          </div>
          <span className="text-2xl">🔧</span>
        </div>
      </Card>
    </div>
  );
}
