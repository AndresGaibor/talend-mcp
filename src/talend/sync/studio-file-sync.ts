import { existsSync, mkdirSync, writeFileSync, copyFileSync } from "node:fs";
import { join, dirname, basename } from "node:path";

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
};

const SNAPSHOT_DIR = ".talend-mcp-snapshots";
const SNAPSHOT_RETENTION = 10;

function getSnapshotDir(projectPath: string): string {
  return join(projectPath, SNAPSHOT_DIR);
}

function generateSnapshotId(): string {
  return `snapshot_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

function ensureSnapshotDir(projectPath: string): string {
  const dir = getSnapshotDir(projectPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export async function getSyncStatus(
  projectPath: string,
  bridgeClient: { workbenchState: () => Promise<{ ok: boolean; data?: { windows?: Array<{ activeEditor?: { title?: string; dirty?: boolean } }> } }> } | null
): Promise<SyncStatus> {
  const snapshotDir = getSnapshotDir(projectPath);
  const hasSnapshot = existsSync(snapshotDir);

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
          jobOpen = true;
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
    snapshotPath: hasSnapshot ? snapshotDir : null,
    bridgeAvailable,
  };
}

export async function createSnapshot(
  projectPath: string,
  itemPath: string,
  propertiesPath: string
): Promise<{ ok: boolean; snapshotPath: string | null; error?: string }> {
  const snapshotId = generateSnapshotId();
  const snapshotDir = ensureSnapshotDir(projectPath);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

  try {
    const itemBackup = join(snapshotDir, `${basename(itemPath)}.${timestamp}.backup`);
    const propsBackup = join(snapshotDir, `${basename(propertiesPath)}.${timestamp}.backup`);

    if (existsSync(itemPath)) {
      copyFileSync(itemPath, itemBackup);
    }

    if (existsSync(propertiesPath)) {
      copyFileSync(propertiesPath, propsBackup);
    }

    const manifest = {
      snapshotId,
      timestamp: Date.now(),
      itemPath,
      propertiesPath,
      itemBackup,
      propsBackup,
    };

    const manifestPath = join(snapshotDir, `${snapshotId}.json`);
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");

    return { ok: true, snapshotPath: manifestPath };
  } catch (e) {
    return { ok: false, snapshotPath: null, error: e instanceof Error ? e.message : String(e) };
  }
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

  const snapshotResult = await createSnapshot(projectPath, itemPath, propertiesPath);

  return {
    ok: true,
    blocked: false,
    snapshotCreated: snapshotResult.ok,
    snapshotPath: snapshotResult.snapshotPath,
  };
}

export async function afterFileEdit(
  projectPath: string,
  editedFiles: string[],
  bridgeClient: { refreshWorkspace: () => Promise<any>; activeJobModel: () => Promise<any> } | null
): Promise<SyncResult> {
  const steps: SyncStep[] = [];
  const startTime = Date.now();

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
    }
  } else {
    steps.push({ name: "workspace_refreshed", ok: false, error: "Bridge no disponible", durationMs: Date.now() - refreshStart });
  }

  let validateStart = Date.now();
  let validatedWithStudio = false;

  if (bridgeClient) {
    try {
      const model = await bridgeClient.activeJobModel();
      validatedWithStudio = model.ok && model.data !== undefined;
      steps.push({ name: "studio_model_validated", ok: validatedWithStudio, durationMs: Date.now() - validateStart });
    } catch (e) {
      steps.push({
        name: "studio_model_validated",
        ok: false,
        error: e instanceof Error ? e.message : String(e),
        durationMs: Date.now() - validateStart,
      });
    }
  } else {
    steps.push({ name: "studio_model_validated", ok: false, error: "Bridge no disponible", durationMs: Date.now() - validateStart });
  }

  return {
    ok: steps.every((s) => s.ok),
    source: bridgeClient ? "mcp+studio-bridge" : "workspace-files",
    confidence: bridgeClient ? "high" : "medium",
    steps,
    editedFiles,
    validatedWithStudio,
    snapshotPath: null,
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
  if (editResult.editedXml) {
    writeFileSync(itemPath, editResult.editedXml, "utf8");
  }
  steps.push({ name: "write_item_file", ok: true, durationMs: Date.now() - writeStart });

  const afterResult = await afterFileEdit(projectPath, [itemPath], bridgeClient);

  return {
    ...afterResult,
    steps: [...steps, ...afterResult.steps],
    snapshotPath: beforeResult.snapshotPath,
  };
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
  if (patchResult.patchedXml) {
    writeFileSync(itemPath, patchResult.patchedXml, "utf8");
  }
  steps.push({ name: "write_item_file", ok: true, durationMs: Date.now() - writeStart });

  const afterResult = await afterFileEdit(projectPath, [itemPath], bridgeClient);

  return {
    ...afterResult,
    steps: [...steps, ...afterResult.steps],
    snapshotPath: beforeResult.snapshotPath,
  };
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
  if (connResult.modifiedXml) {
    writeFileSync(itemPath, connResult.modifiedXml, "utf8");
  }
  steps.push({ name: "write_item_file", ok: true, durationMs: Date.now() - writeStart });

  const afterResult = await afterFileEdit(projectPath, [itemPath], bridgeClient);

  return {
    ...afterResult,
    steps: [...steps, ...afterResult.steps],
    snapshotPath: beforeResult.snapshotPath,
  };
}