import type { BridgeResult, BridgeWorkspaceState } from "../domain/bridge.types";
import type { IStudioBridgePort } from "../ports/studio-bridge.port";

export class GetWorkspaceStateUseCase {
  constructor(private readonly bridge: IStudioBridgePort) {}

  async execute(): Promise<BridgeResult<BridgeWorkspaceState>> {
    return await this.bridge.workspaceState();
  }
}