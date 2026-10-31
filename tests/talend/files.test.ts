import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { isPathInside, listFilesRecursive, normalizePath, writeTextFileAtomically } from "../../src/talend/files";

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

describe("escritura atomica", () => {
  test("reemplaza el contenido sin dejar temporales", () => {
    const destino = join(root, "job_0.1.item");
    writeTextFileAtomically(destino, "version vieja");
    writeTextFileAtomically(destino, "version nueva");

    expect(readFileSync(destino, "utf8")).toBe("version nueva");
    const temporales = readdirSync(root).filter((nombre) => nombre.includes(".tmp-"));
    expect(temporales).toEqual([]);
  });

  test("crea las carpetas que falten", () => {
    const destino = join(root, "a", "b", "job.item");
    writeTextFileAtomically(destino, "<item/>");
    expect(existsSync(destino)).toBe(true);
  });

  test("no escribe fuera de la carpeta permitida", () => {
    expect(() => writeTextFileAtomically(join(root, "..", "fuera.item"), "x", root))
      .toThrow(/fuera del workspace/);
  });
});
