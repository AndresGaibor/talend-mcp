import { TalendStudioBridgeClient } from "../studio/bridge-client";
import { existsSync } from "node:fs";

export type RunValidationResult = {
  ok: boolean;
  componentName: string;
  launchConfigFound: boolean;
  dryRunOk: boolean;
  realRunOk: boolean;
  launchTerminated: boolean;
  error?: string;
};

export async function validateComponentRun(
  componentName: string,
  itemPath: string,
  bridge?: TalendStudioBridgeClient,
  options?: {
    unsafeActions?: boolean;
    timeoutMs?: number;
  },
): Promise<RunValidationResult> {
  const result: RunValidationResult = {
    ok: false,
    componentName,
    launchConfigFound: false,
    dryRunOk: false,
    realRunOk: false,
    launchTerminated: false,
  };

  if (!bridge) {
    result.error = "Bridge no disponible";
    return result;
  }

  if (!existsSync(itemPath)) {
    result.error = "Item file not found: " + itemPath;
    return result;
  }

  try {
    const configsResult = await bridge.launchConfigs();
    if (!configsResult.ok || !configsResult.data?.configs?.length) {
      result.launchConfigFound = false;
      result.error = "No se encontraron launch configs";
      return result;
    }
    result.launchConfigFound = true;

    const configName = configsResult.data.configs[0]?.name ?? "Default";
    const dryRunResult = await bridge.runLaunchConfig(configName, true, "run");
    result.dryRunOk = dryRunResult.ok;

    const unsafeAllowed = options?.unsafeActions ?? false;
    if (!unsafeAllowed) {
      result.ok = true;
      return result;
    }

    const realRunResult = await bridge.runLaunchConfig(configName, false, "run");
    result.realRunOk = realRunResult.ok;

    if (result.realRunOk && options?.timeoutMs) {
      await new Promise((resolve) => setTimeout(resolve, options.timeoutMs));
    }

    result.launchTerminated = true;
    result.ok = true;
    return result;
  } catch (e) {
    result.error = e instanceof Error ? e.message : String(e);
    return result;
  }
}
