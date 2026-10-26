import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { SnapshotInfo, SnapshotManifest } from "./types";
import { getSnapshotDir } from "./paths";

export async function listSnapshots(projectPath: string): Promise<SnapshotInfo[]> {
  const snapshotDir = getSnapshotDir(projectPath);

  if (!existsSync(snapshotDir)) {
    return [];
  }

  const manifests: SnapshotInfo[] = [];

  try {
    const files = readdirSync(snapshotDir).filter((f) => f.endsWith(".json"));

    for (const file of files) {
      try {
        const content = readFileSync(join(snapshotDir, file), "utf8");
        const manifest = JSON.parse(content) as SnapshotManifest;
        const manifestPath = join(snapshotDir, file);
        manifests.push({
          snapshotId: manifest.snapshotId,
          createdAt: manifest.createdAt,
          jobName: manifest.jobName,
          reason: manifest.reason,
          itemPath: manifest.itemPath,
          propertiesPath: manifest.propertiesPath,
          manifestPath,
        });
      } catch {
      }
    }
  } catch {
  }

  return manifests.sort((a, b) => b.createdAt - a.createdAt);
}
