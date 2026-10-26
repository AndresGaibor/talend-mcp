import { existsSync, copyFileSync } from "node:fs";

import { readSnapshot } from "./read";

export async function restoreSnapshot(
  projectPath: string,
  snapshotId: string,
): Promise<{ ok: boolean; restoredFiles: string[]; error?: string }> {
  const manifest = await readSnapshot(projectPath, snapshotId);

  if (!manifest) {
    return { ok: false, restoredFiles: [], error: "Snapshot not found: " + snapshotId };
  }

  const restoredFiles: string[] = [];

  try {
    for (const file of manifest.files) {
      if (existsSync(file.backup)) {
        copyFileSync(file.backup, file.original);
        restoredFiles.push(file.original);
      }
    }

    return { ok: true, restoredFiles };
  } catch (e) {
    return { ok: false, restoredFiles, error: e instanceof Error ? e.message : String(e) };
  }
}
