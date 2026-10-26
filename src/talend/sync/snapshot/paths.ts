import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const SNAPSHOT_DIR = ".talend-mcp-snapshots";

export function getSnapshotDir(projectPath: string): string {
  return join(projectPath, SNAPSHOT_DIR);
}

export function ensureSnapshotDir(projectPath: string): string {
  const dir = getSnapshotDir(projectPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function generateSnapshotId(): string {
  return "snapshot_" + Date.now() + "_" + Math.random().toString(36).substring(2, 8);
}
