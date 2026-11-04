import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { ensureSnapshotDir } from "../../src/talend/sync/snapshot/paths";

const root = mkdtempSync(join(tmpdir(), "talend-snapshot-git-"));

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

function repoWithProject(): { repo: string; project: string } {
  const repo = join(root, "repo-" + Math.random().toString(36).slice(2, 8));
  const project = join(repo, "PRJ_DEMO");
  mkdirSync(join(repo, ".git"), { recursive: true });
  mkdirSync(project, { recursive: true });
  return { repo, project };
}

describe("ensureSnapshotDir y git", () => {
  test("excluye los snapshots en .git/info/exclude del repo que contiene el proyecto", () => {
    const { repo, project } = repoWithProject();
    ensureSnapshotDir(project);
    const exclude = readFileSync(join(repo, ".git", "info", "exclude"), "utf8");
    expect(exclude.split(/\r?\n/)).toContain(".talend-mcp-snapshots/");
  });

  test("no duplica la linea si se llama varias veces", () => {
    const { repo, project } = repoWithProject();
    ensureSnapshotDir(project);
    ensureSnapshotDir(project);
    const exclude = readFileSync(join(repo, ".git", "info", "exclude"), "utf8");
    expect(exclude.split(/\r?\n/).filter((l) => l === ".talend-mcp-snapshots/")).toHaveLength(1);
  });

  test("conserva lo que ya hubiera en el archivo de exclusiones", () => {
    const { repo, project } = repoWithProject();
    mkdirSync(join(repo, ".git", "info"), { recursive: true });
    writeFileSync(join(repo, ".git", "info", "exclude"), "# mio\n*.tmp", "utf8");
    ensureSnapshotDir(project);
    const lines = readFileSync(join(repo, ".git", "info", "exclude"), "utf8").split(/\r?\n/);
    expect(lines).toContain("*.tmp");
    expect(lines).toContain(".talend-mcp-snapshots/");
  });

  test("fuera de un repo git crea el directorio y no inventa un .git", () => {
    const project = join(root, "sin-git-" + Math.random().toString(36).slice(2, 8));
    mkdirSync(project, { recursive: true });
    const dir = ensureSnapshotDir(project);
    expect(existsSync(dir)).toBe(true);
    expect(existsSync(join(project, ".git"))).toBe(false);
  });
});
