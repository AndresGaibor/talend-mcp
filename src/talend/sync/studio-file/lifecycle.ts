import { createSnapshot as snapshotManagerCreateSnapshot } from "../snapshot-manager";

import type { SyncResult, SyncStep } from "./types";
import { getSyncStatus } from "./status";

export async function beforeFileEdit(
  projectPath: string,
  itemPath: string,
  propertiesPath: string,
  bridgeClient: { workbenchState: () => Promise<any>; saveActiveEditor: () => Promise<any> } | null
): Promise<{ ok: boolean; blocked: boolean; reason?: string; snapshotCreated: boolean; snapshotPath: string | null }> {
  const status = await getSyncStatus(projectPath, bridgeClient as any);

  if (status.jobOpen && status.editorDirty) {
    if (!bridgeClient) {
      return {
        ok: false,
        blocked: true,
        reason: "Job abierto en Studio con editor dirty. Sin bridge no se puede guardar.",
        snapshotCreated: false,
        snapshotPath: null,
      };
    }

    const saveResult = await bridgeClient.saveActiveEditor();
    if (!saveResult.ok) {
      return {
        ok: false,
        blocked: true,
        reason: "Job abierto con editor dirty y el intento de guardar falló.",
        snapshotCreated: false,
        snapshotPath: null,
      };
    }
  }

  const snapshotResult = await snapshotManagerCreateSnapshot(
    projectPath,
    itemPath,
    propertiesPath,
    "before_file_edit"
  );

  return {
    ok: true,
    blocked: false,
    snapshotCreated: snapshotResult.ok,
    snapshotPath: snapshotResult.manifestPath,
  };
}

export async function afterFileEdit(
  projectPath: string,
  editedFiles: string[],
  bridgeClient: { refreshWorkspace: () => Promise<any>; activeJobModel: () => Promise<any> } | null
): Promise<SyncResult> {
  const steps: SyncStep[] = [];
  const startTime = Date.now();
  const warnings: string[] = [];

  steps.push({ name: "file_edit_applied", ok: true, durationMs: Date.now() - startTime });

  let refreshStart = Date.now();
  if (bridgeClient) {
    try {
      await bridgeClient.refreshWorkspace();
      steps.push({ name: "workspace_refreshed", ok: true, durationMs: Date.now() - refreshStart });
    } catch (e) {
      steps.push({
        name: "workspace_refreshed",
        ok: false,
        error: e instanceof Error ? e.message : String(e),
        durationMs: Date.now() - refreshStart,
      });
      warnings.push("No se pudo refrescar el workspace: " + (e instanceof Error ? e.message : String(e)));
    }
  } else {
    steps.push({ name: "workspace_refreshed", ok: false, error: "Bridge no disponible", durationMs: Date.now() - refreshStart });
    warnings.push("Bridge no disponible; no se pudo refrescar workspace.");
  }

  let validateStart = Date.now();
  let validatedWithStudio = false;

  if (bridgeClient) {
    try {
      const model = await bridgeClient.activeJobModel();
      validatedWithStudio = model.ok && model.data !== undefined;
      steps.push({ name: "studio_model_validated", ok: validatedWithStudio, durationMs: Date.now() - validateStart });
      if (!validatedWithStudio) {
        warnings.push("No se pudo validar el modelo interno del job.");
      }
    } catch (e) {
      steps.push({
        name: "studio_model_validated",
        ok: false,
        error: e instanceof Error ? e.message : String(e),
        durationMs: Date.now() - validateStart,
      });
      warnings.push("Validación del modelo falló: " + (e instanceof Error ? e.message : String(e)));
    }
  } else {
    steps.push({ name: "studio_model_validated", ok: false, error: "Bridge no disponible", durationMs: Date.now() - validateStart });
    warnings.push("Bridge no disponible; no se pudo validar modelo interno.");
  }

  return {
    ok: true,
    source: bridgeClient ? "mcp+studio-bridge" : "workspace-files",
    confidence: bridgeClient ? "high" : "medium",
    steps,
    editedFiles,
    validatedWithStudio,
    snapshotPath: null,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}
