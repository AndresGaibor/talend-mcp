import { TalendStudioBridgeClient } from "../studio/bridge-client";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { createPlatformContext } from "../../platform";
import { toTalendHostPath } from "../../platform/path-bridge";

export type StudioValidationResult = {
  ok: boolean;
  componentName: string;
  itemPath: string;
  opensInStudio: boolean;
  modelValid: boolean;
  problemsCount: number;
  error?: string;
};

export async function validateComponentInStudio(
  componentName: string,
  itemPath: string,
  bridge?: TalendStudioBridgeClient,
): Promise<StudioValidationResult> {
  const result: StudioValidationResult = {
    ok: false,
    componentName,
    itemPath,
    opensInStudio: false,
    modelValid: false,
    problemsCount: 0,
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
    const ctx = createPlatformContext();
    const studioPath = toTalendHostPath(itemPath, ctx);
    const openResult = await bridge.openResource(studioPath);
    result.opensInStudio = openResult.ok;

    if (!result.opensInStudio) {
      result.error = "No se pudo abrir el recurso en Studio";
      return result;
    }

    const modelResult = await bridge.activeJobModel();
    result.modelValid = modelResult.ok && !!modelResult.data;

    const problemsResult = await bridge.problemsMarkers();
    if (problemsResult.ok && problemsResult.data) {
      const markers = (problemsResult.data as any).markers ?? [];
      result.problemsCount = markers.length;
    }

    result.ok = true;
    return result;
  } catch (e) {
    result.error = e instanceof Error ? e.message : String(e);
    return result;
  }
}
