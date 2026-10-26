import { existsSync, readFileSync } from "node:fs";

import { readSnapshot } from "./read";

type SnapshotDiff = {
  file: string;
  changed: boolean;
  beforeLength: number;
  afterLength: number;
  beforePreview?: string;
  afterPreview?: string;
};

export async function diffSnapshot(
  projectPath: string,
  snapshotId: string,
): Promise<{
  ok: boolean;
  diffs: SnapshotDiff[];
  error?: string;
}> {
  const manifest = await readSnapshot(projectPath, snapshotId);

  if (!manifest) {
    return { ok: false, diffs: [], error: "Snapshot not found: " + snapshotId };
  }

  const diffs: SnapshotDiff[] = [];

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
