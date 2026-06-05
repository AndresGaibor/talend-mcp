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
import type { IStudioBridgePort } from "../ports/studio-bridge.port";
import {
  createBridgeClient,
  type BridgeConfig,
  type TalendStudioBridgeClient,
} from "./http-studio-bridge.client";

export class HttpStudioBridgeAdapter implements IStudioBridgePort {
  private client!: TalendStudioBridgeClient;

  constructor(private readonly config?: Partial<BridgeConfig>) {}

  private async getClient() {
    if (!this.client) {
      this.client = await createBridgeClient({ config: this.config });
    }
    return this.client;
  }

  async getConfig(): Promise<{ host: string; port: number }> {
    const client = await this.getClient();
    const config = client.getConfig();
    return { host: config.host, port: config.port };
  }

  async getToken(): Promise<string | undefined> {
    const client = await this.getClient();
    return client.getConfig().host !== undefined ? undefined : undefined;
  }

  async ping(): Promise<BridgeResult<BridgePingPayload>> {
    const client = await this.getClient();
    return await client.ping();
  }

  async capabilities(): Promise<BridgeResult<BridgeCapabilities>> {
    const client = await this.getClient();
    return await client.capabilities();
  }

  async auditEnvironment(): Promise<BridgeResult<BridgeEnvironment>> {
    const client = await this.getClient();
    return await client.auditEnvironment();
  }

  async workbenchState(): Promise<BridgeResult<BridgeWorkbenchState>> {
    const client = await this.getClient();
    return await client.workbenchState();
  }

  async selection(): Promise<BridgeResult<Record<string, unknown>>> {
    const client = await this.getClient();
    return await client.selection();
  }

  async views(): Promise<BridgeResult<Record<string, unknown>>> {
    const client = await this.getClient();
    return await client.views();
  }

  async activeJobModel(): Promise<BridgeResult<BridgeActiveJobModel>> {
    const client = await this.getClient();
    return await client.activeJobModel();
  }

  async commandsList(): Promise<BridgeResult<{ commands?: BridgeCommand[] }>> {
    const client = await this.getClient();
    return await client.commandsList();
  }

  async executeCommand(commandId: string, dryRun: boolean): Promise<BridgeResult<Record<string, unknown>>> {
    const client = await this.getClient();
    return await client.executeCommand(commandId, dryRun);
  }

  async launchConfigs(): Promise<BridgeResult<{ configs?: BridgeLaunchConfig[] }>> {
    const client = await this.getClient();
    return await client.launchConfigs();
  }

  async runLaunchConfig(name: string, dryRun: boolean, mode?: string): Promise<BridgeResult<Record<string, unknown>>> {
    const client = await this.getClient();
    return await client.runLaunchConfig(name, dryRun, mode);
  }

  async launchRuns(): Promise<BridgeResult<{ runs?: BridgeLaunchRun[] }>> {
    const client = await this.getClient();
    return await client.launchRuns();
  }

  async launchRunStatus(launchId: string): Promise<BridgeResult<Record<string, unknown>>> {
    const client = await this.getClient();
    return await client.launchRunStatus(launchId);
  }

  async launchWait(launchId: string, timeoutMs?: number): Promise<BridgeResult<Record<string, unknown>>> {
    const client = await this.getClient();
    return await client.launchWait(launchId, timeoutMs);
  }

  async openResource(path: string): Promise<BridgeResult<Record<string, unknown>>> {
    const client = await this.getClient();
    return await client.openResource(path);
  }

  async workspaceState(): Promise<BridgeResult<BridgeWorkspaceState>> {
    const client = await this.getClient();
    return await client.workspaceState();
  }

  async problemsMarkers(): Promise<BridgeResult<{ problems?: BridgeProblemMarker[] }>> {
    const client = await this.getClient();
    return await client.problemsMarkers();
  }
}