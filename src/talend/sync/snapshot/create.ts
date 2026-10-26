import { existsSync, writeFileSync, copyFileSync } from "node:fs";
import { join, basename } from "node:path";

import type { SnapshotManifest } from "./types";
import { ensureSnapshotDir, generateSnapshotId } from "./paths";

export async function createSnapshot(
  projectPath: string,
  itemPath: string,
  propertiesPath: string,
  reason: string,
): Promise<{ ok: boolean; snapshotId: string | null; manifestPath: string | null; error?: string }> {
  const snapshotId = generateSnapshotId();
  const snapshotDir = ensureSnapshotDir(projectPath);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

  const files: Array<{ original: string; backup: string }> = [];

  try {
    if (existsSync(itemPath)) {
      const backup = join(snapshotDir, basename(itemPath) + "." + timestamp + ".backup");
      copyFileSync(itemPath, backup);
      files.push({ original: itemPath, backup });
    }

    if (existsSync(propertiesPath)) {
      const backup = join(snapshotDir, basename(propertiesPath) + "." + timestamp + ".backup");
      copyFileSync(propertiesPath, backup);
      files.push({ original: propertiesPath, backup });
    }

    const jobName = basename(itemPath, ".item").replace(/_[\d.]+$/, "");

    const manifest: SnapshotManifest = {
      snapshotId,
      createdAt: Date.now(),
      jobName,
      itemPath,
      propertiesPath,
      files,
      reason,
    };

    const manifestPath = join(snapshotDir, snapshotId + ".json");
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");

    return { ok: true, snapshotId, manifestPath };
  } catch (e) {
    return { ok: false, snapshotId: null, manifestPath: null, error: e instanceof Error ? e.message : String(e) };
  }
}
