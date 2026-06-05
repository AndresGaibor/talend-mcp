import type { BridgeResult, BridgeProblemMarker } from "../domain/bridge.types";
import type { IStudioBridgePort } from "../ports/studio-bridge.port";

export interface ProblemsResult {
  problems: BridgeProblemMarker[];
  total: number;
}

export class GetProblemsUseCase {
  constructor(private readonly bridge: IStudioBridgePort) {}

  async execute(): Promise<BridgeResult<{ problems?: BridgeProblemMarker[] }>> {
    return await this.bridge.problemsMarkers();
  }
}