import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  createSnapshot,
  diffSnapshot,
  listSnapshots,
  readSnapshot,
  restoreSnapshot,
} from "../../src/talend/sync/snapshot-manager";

const root = mkdtempSync(join(tmpdir(), "talend-snapshot-"));
const itemPath = join(root, "MiJob_0.1.item");
const propertiesPath = join(root, "MiJob_0.1.properties");
const itemContent = "<job/>";
const propertiesContent = "context.name=Default\n";

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

// Cada escenario usa su propio proyecto para no mezclar manifiestos.
function newProjectPath(): string {
  const dir = join(root, "proyecto-" + Math.random().toString(36).slice(2, 8));
  mkdirSync(dir, { recursive: true });
  return dir;
}

function writeJobFiles(): void {
  writeFileSync(itemPath, itemContent, "utf8");
  writeFileSync(propertiesPath, propertiesContent, "utf8");
}

describe("snapshot manager", () => {
  test("crear snapshot copia item y properties y deja el manifiesto", async () => {
    writeJobFiles();
    const projectPath = newProjectPath();

    const result = await createSnapshot(projectPath, itemPath, propertiesPath, "before_file_edit");

    expect(result.ok).toBe(true);
    expect(result.snapshotId).not.toBeNull();
    expect(result.manifestPath).toEndWith(".json");

    const manifest = await readSnapshot(projectPath, result.snapshotId!);
    expect(manifest).not.toBeNull();
    expect(manifest?.jobName).toBe("MiJob");
    expect(manifest?.reason).toBe("before_file_edit");
    expect(manifest?.itemPath).toBe(itemPath);
    expect(manifest?.propertiesPath).toBe(propertiesPath);
    expect(manifest?.files).toHaveLength(2);
  });

  test("listar snapshots devuelve la informacion resumida del manifiesto", async () => {
    writeJobFiles();
    const projectPath = newProjectPath();
    const created = await createSnapshot(projectPath, itemPath, propertiesPath, "manual");

    const snapshots = await listSnapshots(projectPath);

    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]?.snapshotId).toBe(created.snapshotId!);
    expect(snapshots[0]?.jobName).toBe("MiJob");
    expect(snapshots[0]?.reason).toBe("manual");
    expect(snapshots[0]?.manifestPath).toBe(created.manifestPath!);
  });

  test("leer un snapshot inexistente devuelve null", async () => {
    const manifest = await readSnapshot(newProjectPath(), "snapshot_inexistente");

    expect(manifest).toBeNull();
  });

  test("comparar detecta el archivo modificado y conserva las longitudes", async () => {
    writeJobFiles();
    const projectPath = newProjectPath();
    const created = await createSnapshot(projectPath, itemPath, propertiesPath, "before_file_edit");

    const modified = "<job><component/></job>";
    writeFileSync(itemPath, modified, "utf8");

    const diff = await diffSnapshot(projectPath, created.snapshotId!);

    expect(diff.ok).toBe(true);
    expect(diff.diffs).toHaveLength(2);
    const itemDiff = diff.diffs.find((entry) => entry.file === itemPath);
    expect(itemDiff?.changed).toBe(true);
    expect(itemDiff?.beforeLength).toBe(itemContent.length);
    expect(itemDiff?.afterLength).toBe(modified.length);
    expect(diff.diffs.find((entry) => entry.file === propertiesPath)?.changed).toBe(false);
  });

  test("restaurar devuelve el contenido original del snapshot", async () => {
    writeJobFiles();
    const projectPath = newProjectPath();
    const created = await createSnapshot(projectPath, itemPath, propertiesPath, "before_file_edit");

    writeFileSync(itemPath, "<job><roto/></job>", "utf8");

    const restored = await restoreSnapshot(projectPath, created.snapshotId!);

    expect(restored.ok).toBe(true);
    expect(restored.restoredFiles).toContain(itemPath);
    expect(readFileSync(itemPath, "utf8")).toBe(itemContent);
  });

  test("restaurar un snapshot inexistente falla con error explicito", async () => {
    const restored = await restoreSnapshot(newProjectPath(), "snapshot_inexistente");

    expect(restored.ok).toBe(false);
    expect(restored.restoredFiles).toEqual([]);
    expect(restored.error).toContain("Snapshot not found");
  });

  test("comparar un snapshot inexistente falla con error explicito", async () => {
    const diff = await diffSnapshot(newProjectPath(), "snapshot_inexistente");

    expect(diff.ok).toBe(false);
    expect(diff.diffs).toEqual([]);
    expect(diff.error).toContain("Snapshot not found");
  });
});
