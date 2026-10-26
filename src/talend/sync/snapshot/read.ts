import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { SnapshotManifest } from "./types";
import { getSnapshotDir } from "./paths";

export async function readSnapshot(projectPath: string, snapshotId: string): Promise<SnapshotManifest | null> {
  const manifestPath = join(getSnapshotDir(projectPath), snapshotId + ".json");

  if (!existsSync(manifestPath)) {
    return null;
  }

  try {
    const content = readFileSync(manifestPath, "utf8");
    return JSON.parse(content) as SnapshotManifest;
  } catch {
    return null;
  }
}
