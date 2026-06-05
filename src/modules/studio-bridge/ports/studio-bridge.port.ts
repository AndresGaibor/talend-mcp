import type {
  BridgeResult,
  BridgePingPayload,
  BridgeCapabilities,
  BridgeEnvironment,
  BridgeWorkbenchState,
  BridgeCommand,
  BridgeLaunchConfig,
  BridgeActiveJobModel,
  BridgeWorkspaceState,
  BridgeProblemMarker,
  BridgeLaunchRun,
} from "../domain/bridge.types";

export interface IStudioBridgePort {
  getConfig(): Promise<{ host: string; port: number }>;
  getToken(): Promise<string | undefined>;
  ping(): Promise<BridgeResult<BridgePingPayload>>;
  capabilities(): Promise<BridgeResult<BridgeCapabilities>>;
  auditEnvironment(): Promise<BridgeResult<BridgeEnvironment>>;
  workbenchState(): Promise<BridgeResult<BridgeWorkbenchState>>;
  selection(): Promise<BridgeResult<Record<string, unknown>>>;
  views(): Promise<BridgeResult<Record<string, unknown>>>;
  activeJobModel(): Promise<BridgeResult<BridgeActiveJobModel>>;
  commandsList(): Promise<BridgeResult<{ commands?: BridgeCommand[] }>>;
  executeCommand(commandId: string, dryRun: boolean): Promise<BridgeResult<Record<string, unknown>>>;
  launchConfigs(): Promise<BridgeResult<{ configs?: BridgeLaunchConfig[] }>>;
  runLaunchConfig(name: string, dryRun: boolean, mode?: string): Promise<BridgeResult<Record<string, unknown>>>;
  launchRuns(): Promise<BridgeResult<{ runs?: BridgeLaunchRun[] }>>;
  launchRunStatus(launchId: string): Promise<BridgeResult<Record<string, unknown>>>;
  launchWait(launchId: string, timeoutMs?: number): Promise<BridgeResult<Record<string, unknown>>>;
  openResource(path: string): Promise<BridgeResult<Record<string, unknown>>>;
  workspaceState(): Promise<BridgeResult<BridgeWorkspaceState>>;
  problemsMarkers(): Promise<BridgeResult<{ problems?: BridgeProblemMarker[] }>>;
}