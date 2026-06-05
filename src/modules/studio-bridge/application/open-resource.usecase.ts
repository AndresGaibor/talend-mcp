import type { BridgeResult } from "../domain/bridge.types";
import type { IStudioBridgePort } from "../ports/studio-bridge.port";
import type { PlatformContext } from "../../../platform";
import { toTalendHostPath } from "../../../platform";

export interface OpenResourceInput {
  mcpPath: string;
  ctx: PlatformContext;
}

export interface OpenResourceResult {
  ok: boolean;
  message: string;
  talendHostPath?: string;
}

export class OpenResourceUseCase {
  constructor(private readonly bridge: IStudioBridgePort) {}

  async execute(input: OpenResourceInput): Promise<BridgeResult<Record<string, unknown>>> {
    const talendHostPath = toTalendHostPath(input.mcpPath, input.ctx);
    return await this.bridge.openResource(talendHostPath);
  }
}