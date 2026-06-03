import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { join, basename } from "node:path";

const SNAPSHOT_DIR = ".talend-mcp-snapshots";
const SNAPSHOT_RETENTION = 10;

function getSnapshotDir(projectPath: string): string {
  return join(projectPath, SNAPSHOT_DIR);
}

function ensureSnapshotDir(projectPath: string): string {
  const dir = getSnapshotDir(projectPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function generateSnapshotId(): string {
  return "snapshot_" + Date.now() + "_" + Math.random().toString(36).substring(2, 8);
}

export type SnapshotManifest = {
  snapshotId: string;
  createdAt: number;
  jobName: string;
  itemPath: string;
  propertiesPath: string;
  files: Array<{
    original: string;
    backup: string;
  }>;
  reason: string;
};

export type SnapshotInfo = {
  snapshotId: string;
  createdAt: number;
  jobName: string;
  reason: string;
  itemPath: string;
  propertiesPath: string;
  manifestPath: string;
};

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

export async function diffSnapshot(
  projectPath: string,
  snapshotId: string,
): Promise<{
  ok: boolean;
  diffs: Array<{
    file: string;
    changed: boolean;
    beforeLength: number;
    afterLength: number;
    beforePreview?: string;
    afterPreview?: string;
  }>;
  error?: string;
}> {
  const manifest = await readSnapshot(projectPath, snapshotId);

  if (!manifest) {
    return { ok: false, diffs: [], error: "Snapshot not found: " + snapshotId };
  }

  const diffs = [];

  for (const file of manifest.files) {
    if (!existsSync(file.backup) || !existsSync(file.original)) {
      diffs.push({
        file: file.original,
        changed: true,
        beforeLength: existsSync(file.backup) ? readFileSync(file.backup, "utf8").length : 0,
        afterLength: existsSync(file.original) ? readFileSync(file.original, "utf8").length : 0,
      });
      continue;
    }

    const before = readFileSync(file.backup, "utf8");
    const after = readFileSync(file.original, "utf8");

    diffs.push({
      file: file.original,
      changed: before !== after,
      beforeLength: before.length,
      afterLength: after.length,
      beforePreview: before.slice(0, 500),
      afterPreview: after.slice(0, 500),
    });
  }

  return { ok: true, diffs };
}
