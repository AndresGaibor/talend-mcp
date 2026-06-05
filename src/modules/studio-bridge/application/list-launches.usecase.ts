import type { BridgeResult, BridgeLaunchRun } from "../domain/bridge.types";
import type { IStudioBridgePort } from "../ports/studio-bridge.port";

export interface LaunchesResult {
  runs: BridgeLaunchRun[];
  total: number;
}

export class ListLaunchesUseCase {
  constructor(private readonly bridge: IStudioBridgePort) {}

  async execute(): Promise<BridgeResult<{ runs?: BridgeLaunchRun[] }>> {
    return await this.bridge.launchRuns();
  }
}