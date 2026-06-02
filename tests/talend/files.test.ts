import { describe, expect, test } from "bun:test";
import { isPathInside, normalizePath } from "../../src/talend/files";

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