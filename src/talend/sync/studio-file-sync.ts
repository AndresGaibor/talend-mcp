import { existsSync, writeFileSync } from "node:fs";
import { createSnapshot as snapshotManagerCreateSnapshot } from "./snapshot-manager";

export type SyncStatus = {
  ok: boolean;
  source: "mcp+studio-bridge" | "workspace-files" | "unavailable";
  confidence: "high" | "medium" | "low";
  jobOpen: boolean;
  editorDirty: boolean;
  editorTitle: string | null;
  itemPath: string | null;
  propertiesPath: string | null;
  hasSnapshot: boolean;
  snapshotPath: string | null;
  bridgeAvailable: boolean;
};

export type SyncStep = {
  name: string;
  ok: boolean;
  error?: string;
  durationMs?: number;
};

export type SyncResult = {
  ok: boolean;
  source: "mcp+studio-bridge" | "workspace-files" | "unavailable";
  confidence: "high" | "medium" | "low";
  steps: SyncStep[];
  editedFiles: string[];
  validatedWithStudio: boolean;
  snapshotPath: string | null;
  warnings?: string[];
};

export async function getSyncStatus(
  projectPath: string,
  bridgeClient: { workbenchState: () => Promise<{ ok: boolean; data?: { windows?: Array<{ activeEditor?: { title?: string; dirty?: boolean } }> } }> } | null
): Promise<SyncStatus> {
  const { listSnapshots } = await import("./snapshot-manager");
  const snapshots = await listSnapshots(projectPath);
  const hasSnapshot = snapshots.length > 0;
  const snapshotPath = hasSnapshot ? (snapshots[0]?.manifestPath ?? null) : null;

  let bridgeAvailable = false;
  let jobOpen = false;
  let editorDirty = false;
  let editorTitle: string | null = null;

  if (bridgeClient) {
    try {
      const state = await bridgeClient.workbenchState();
      if (state.ok && state.data?.windows?.[0]) {
        bridgeAvailable = true;
        const activeEditor = state.data.windows[0].activeEditor;
        if (activeEditor) {
          const title = activeEditor.title ?? "";
          const editorId = (activeEditor as any).editorId ?? (activeEditor as any).siteId ?? "";
          const looksLikeTalendJob =
            editorId.includes("ProcessTalendEditor") ||
            title.startsWith("Job ") ||
            title.includes("_0.") ||
            title.includes(" 0.");
          jobOpen = looksLikeTalendJob;
          editorDirty = activeEditor.dirty ?? false;
          editorTitle = activeEditor.title ?? null;
        }
      }
    } catch {
      bridgeAvailable = false;
    }
  }

  return {
    ok: true,
    source: bridgeAvailable ? "mcp+studio-bridge" : "workspace-files",
    confidence: bridgeAvailable ? "high" : "medium",
    jobOpen,
    editorDirty,
    editorTitle,
    itemPath: null,
    propertiesPath: null,
    hasSnapshot,
    snapshotPath: hasSnapshot ? snapshotPath : null,
    bridgeAvailable,
  };
}

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

function mergeSyncResults(
  beforeSteps: SyncStep[],
  beforeSnapshotPath: string | null,
  writeStepName: string,
  afterResult: SyncResult
): SyncResult {
  const mergedSteps = [...beforeSteps, ...afterResult.steps];

  const criticalStepNames = [
    "validate_inputs",
    "snapshot_created",
    writeStepName,
    "write_item_file",
  ];
  const criticalSteps = mergedSteps.filter((s) => criticalStepNames.includes(s.name));
  const finalOk = criticalSteps.every((s) => s.ok);

  return {
    ...afterResult,
    ok: finalOk,
    steps: mergedSteps,
    snapshotPath: beforeSnapshotPath,
  };
}

export async function safeEditComponentParameter(
  projectPath: string,
  itemPath: string,
  propertiesPath: string,
  bridgeClient: any,
  editFn: () => { ok: boolean; editedXml?: string }
): Promise<SyncResult> {
  const steps: SyncStep[] = [];
  const startTime = Date.now();

  steps.push({ name: "validate_inputs", ok: true, durationMs: Date.now() - startTime });

  const beforeResult = await beforeFileEdit(projectPath, itemPath, propertiesPath, bridgeClient);
  if (!beforeResult.ok && beforeResult.blocked) {
    return {
      ok: false,
      source: "unavailable",
      confidence: "low",
      steps: [{ name: "before_file_edit_blocked", ok: false, error: beforeResult.reason ?? "Blocked" }],
      editedFiles: [],
      validatedWithStudio: false,
      snapshotPath: beforeResult.snapshotPath,
    };
  }

  steps.push({
    name: "snapshot_created",
    ok: beforeResult.snapshotCreated,
  });

  const editStart = Date.now();
  const editResult = editFn();
  steps.push({
    name: "apply_xml_edit",
    ok: editResult.ok,
    durationMs: Date.now() - editStart,
  });

  if (!editResult.ok) {
    return {
      ok: false,
      source: "workspace-files",
      confidence: "medium",
      steps,
      editedFiles: [],
      validatedWithStudio: false,
      snapshotPath: beforeResult.snapshotPath,
    };
  }

  const writeStart = Date.now();
  if (!editResult.editedXml) {
    steps.push({
      name: "write_item_file",
      ok: false,
      error: "editResult.editedXml no fue devuelto",
      durationMs: Date.now() - writeStart,
    });
    return {
      ok: false,
      source: "workspace-files",
      confidence: "low",
      steps,
      editedFiles: [],
      validatedWithStudio: false,
      snapshotPath: beforeResult.snapshotPath,
    };
  }
  writeFileSync(itemPath, editResult.editedXml, "utf8");
  steps.push({ name: "write_item_file", ok: true, durationMs: Date.now() - writeStart });

  const afterResult = await afterFileEdit(projectPath, [itemPath], bridgeClient);

  return mergeSyncResults(steps, beforeResult.snapshotPath, "apply_xml_edit", afterResult);
}

export async function safePatchComponent(
  projectPath: string,
  itemPath: string,
  propertiesPath: string,
  bridgeClient: any,
  patchFn: () => { ok: boolean; patchedXml?: string }
): Promise<SyncResult> {
  const steps: SyncStep[] = [];
  const startTime = Date.now();

  steps.push({ name: "validate_inputs", ok: true, durationMs: Date.now() - startTime });

  const beforeResult = await beforeFileEdit(projectPath, itemPath, propertiesPath, bridgeClient);
  if (!beforeResult.ok && beforeResult.blocked) {
    return {
      ok: false,
      source: "unavailable",
      confidence: "low",
      steps: [{ name: "before_file_edit_blocked", ok: false, error: beforeResult.reason ?? "Blocked" }],
      editedFiles: [],
      validatedWithStudio: false,
      snapshotPath: beforeResult.snapshotPath,
    };
  }

  steps.push({ name: "snapshot_created", ok: beforeResult.snapshotCreated });

  const editStart = Date.now();
  const patchResult = patchFn();
  steps.push({ name: "apply_xml_patch", ok: patchResult.ok, durationMs: Date.now() - editStart });

  if (!patchResult.ok) {
    return {
      ok: false,
      source: "workspace-files",
      confidence: "medium",
      steps,
      editedFiles: [],
      validatedWithStudio: false,
      snapshotPath: beforeResult.snapshotPath,
    };
  }

  const writeStart = Date.now();
  if (!patchResult.patchedXml) {
    steps.push({
      name: "write_item_file",
      ok: false,
      error: "patchResult.patchedXml no fue devuelto",
      durationMs: Date.now() - writeStart,
    });
    return {
      ok: false,
      source: "workspace-files",
      confidence: "low",
      steps,
      editedFiles: [],
      validatedWithStudio: false,
      snapshotPath: beforeResult.snapshotPath,
    };
  }
  writeFileSync(itemPath, patchResult.patchedXml, "utf8");
  steps.push({ name: "write_item_file", ok: true, durationMs: Date.now() - writeStart });

  const afterResult = await afterFileEdit(projectPath, [itemPath], bridgeClient);

  return mergeSyncResults(steps, beforeResult.snapshotPath, "apply_xml_patch", afterResult);
}

export async function safeAddConnection(
  projectPath: string,
  itemPath: string,
  propertiesPath: string,
  bridgeClient: any,
  connectionFn: () => { ok: boolean; modifiedXml?: string }
): Promise<SyncResult> {
  const steps: SyncStep[] = [];
  const startTime = Date.now();

  steps.push({ name: "validate_inputs", ok: true, durationMs: Date.now() - startTime });

  const beforeResult = await beforeFileEdit(projectPath, itemPath, propertiesPath, bridgeClient);
  if (!beforeResult.ok && beforeResult.blocked) {
    return {
      ok: false,
      source: "unavailable",
      confidence: "low",
      steps: [{ name: "before_file_edit_blocked", ok: false, error: beforeResult.reason ?? "Blocked" }],
      editedFiles: [],
      validatedWithStudio: false,
      snapshotPath: beforeResult.snapshotPath,
    };
  }

  steps.push({ name: "snapshot_created", ok: beforeResult.snapshotCreated });

  const editStart = Date.now();
  const connResult = connectionFn();
  steps.push({ name: "apply_xml_connection", ok: connResult.ok, durationMs: Date.now() - editStart });

  if (!connResult.ok) {
    return {
      ok: false,
      source: "workspace-files",
      confidence: "medium",
      steps,
      editedFiles: [],
      validatedWithStudio: false,
      snapshotPath: beforeResult.snapshotPath,
    };
  }

  const writeStart = Date.now();
  if (!connResult.modifiedXml) {
    steps.push({
      name: "write_item_file",
      ok: false,
      error: "connResult.modifiedXml no fue devuelto",
      durationMs: Date.now() - writeStart,
    });
    return {
      ok: false,
      source: "workspace-files",
      confidence: "low",
      steps,
      editedFiles: [],
      validatedWithStudio: false,
      snapshotPath: beforeResult.snapshotPath,
    };
  }
  writeFileSync(itemPath, connResult.modifiedXml, "utf8");
  steps.push({ name: "write_item_file", ok: true, durationMs: Date.now() - writeStart });

  const afterResult = await afterFileEdit(projectPath, [itemPath], bridgeClient);

  return mergeSyncResults(steps, beforeResult.snapshotPath, "apply_xml_connection", afterResult);
}