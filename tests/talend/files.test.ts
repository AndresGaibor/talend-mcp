import { describe, expect, test } from "bun:test";
import { isPathInside, normalizePath } from "../../src/talend/files";

describe("files", () => {
  test("normaliza rutas", () => {
    expect(normalizePath("/tmp/example/../example/file.txt")).toBe("/tmp/example/file.txt");
  });

  test("detecta rutas contenidas", () => {
    expect(isPathInside("/tmp/workspace/project/file.item", "/tmp/workspace")).toBe(true);
    expect(isPathInside("/tmp/other/file.item", "/tmp/workspace")).toBe(false);
  });
});