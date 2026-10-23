import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { isPathInside, listFilesRecursive, normalizePath } from "../../src/talend/files";

const root = mkdtempSync(join(tmpdir(), "talend-files-"));

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("listado recursivo de archivos", () => {
  test("explora directorios y conserva el orden y filtro del resultado", async () => {
    const nested = join(root, "nested", "deeper");
    mkdirSync(nested, { recursive: true });
    writeFileSync(join(root, "z.properties"), "z", "utf8");
    writeFileSync(join(root, "ignored.txt"), "ignored", "utf8");
    writeFileSync(join(nested, "a.properties"), "a", "utf8");

    const files = await listFilesRecursive(root, (path) => path.endsWith(".properties"));

    expect(files.map((path) => path.replace(/\\/g, "/"))).toEqual([
      join(root, "nested", "deeper", "a.properties").replace(/\\/g, "/"),
      join(root, "z.properties").replace(/\\/g, "/"),
    ]);
  });
});

describe("files", () => {
  test("normaliza rutas", () => {
    const result = normalizePath("/tmp/example/../example/file.txt");
    expect(result.endsWith("tmp/example/file.txt")).toBe(true);
  });

  test("detecta rutas contenidas", () => {
    expect(isPathInside("/tmp/workspace/project/file.item", "/tmp/workspace")).toBe(true);
    expect(isPathInside("/tmp/other/file.item", "/tmp/workspace")).toBe(false);
  });
});
