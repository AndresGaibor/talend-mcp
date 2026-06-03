import { existsSync } from "node:fs";
import { basename } from "node:path";
import { TalendStudioBridgeClient } from "../studio/bridge-client";
import type { BridgeLaunchConfig } from "../studio/bridge-client";

export type RunValidationResult = {
  ok: boolean;
  componentName: string;
  launchConfigFound: boolean;
  launchConfigName?: string;
  dryRunOk: boolean;
  realRunOk: boolean;
  launchTerminated: boolean;
  launchId?: string;
  error?: string;
};

export async function validateComponentRun(
  componentName: string,
  itemPath: string,
  bridge?: TalendStudioBridgeClient,
  options?: {
    unsafeActions?: boolean;
    timeoutMs?: number;
    jobName?: string;
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

  const effectiveJobName = options?.jobName ?? basename(itemPath, ".item").replace(/_[\d.]+$/, "");

  try {
    const configsResult = await bridge.launchConfigs();
    if (!configsResult.ok || !configsResult.data?.configs?.length) {
      result.launchConfigFound = false;
      result.error = "No se encontraron launch configs";
      return result;
    }

    const configs = configsResult.data.configs!;
    const matchedConfig = configs.find((c: BridgeLaunchConfig) => {
      const name = c.name ?? "";
      const label = c.attributes?.PROCESS_LABEL ?? c.attributes?.processName ?? "";
      return name.includes(effectiveJobName) || label.includes(effectiveJobName);
    });

    if (!matchedConfig) {
      result.launchConfigFound = false;
      result.error = "No se encontró launch config asociada al job fixture: " + effectiveJobName;
      return result;
    }

    result.launchConfigFound = true;
    result.launchConfigName = matchedConfig.name;

    const configName = matchedConfig.name ?? "Default";
    const dryRunResult = await bridge.runLaunchConfig(configName, true, "run");
    result.dryRunOk = dryRunResult.ok;

    const unsafeAllowed = options?.unsafeActions ?? false;
    if (!unsafeAllowed) {
      result.ok = true;
      return result;
    }

    const realRunResult = await bridge.runLaunchConfig(configName, false, "run");
    result.realRunOk = realRunResult.ok;

    const launchId = (realRunResult as any).data?.launchId;
    if (launchId) {
      result.launchId = launchId;
      try {
        const statusResult = await bridge.eventsRecent();
        result.launchTerminated = statusResult.ok && (statusResult.data as any)?.terminated === true;
      } catch {
        result.launchTerminated = false;
      }
    } else {
      result.launchTerminated = false;
    }

    result.ok = result.realRunOk;
    return result;
  } catch (e) {
    result.error = e instanceof Error ? e.message : String(e);
    return result;
  }
}