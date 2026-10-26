import type { SyncStatus } from "./types";

export async function getSyncStatus(
  projectPath: string,
  bridgeClient: { workbenchState: () => Promise<{ ok: boolean; data?: { windows?: Array<{ activeEditor?: { title?: string; dirty?: boolean } }> } }> } | null
): Promise<SyncStatus> {
  const { listSnapshots } = await import("../snapshot-manager");
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
