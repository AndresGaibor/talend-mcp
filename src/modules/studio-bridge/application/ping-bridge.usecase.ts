import type { BridgeResult, BridgePingPayload } from "../domain/bridge.types";
import type { IStudioBridgePort } from "../ports/studio-bridge.port";

export class PingBridgeUseCase {
  constructor(private readonly bridge: IStudioBridgePort) {}

  async execute(): Promise<BridgeResult<BridgePingPayload>> {
    return await this.bridge.ping();
  }
}