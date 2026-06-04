import { test, expect, describe } from "bun:test";
import { toMcpPath, toTalendHostPath, normalizeLogicalTalendFolderPath, getBaseNamePortable, getDirNamePortable, splitPortable } from "../../src/platform/path-bridge";
import type { PlatformContext } from "../../src/platform/runtime";

const wslContext: PlatformContext = {
  runtimeOs: "wsl",
  talendHostOs: "windows",
  pathMode: "wsl-windows",
};

const nativeContext: PlatformContext = {
  runtimeOs: "macos",
  talendHostOs: "macos",
  pathMode: "native",
};

describe("toMcpPath", () => {
  test("pathMode native no convierte", () => {
    expect(toMcpPath("/home/user/file.item", nativeContext)).toBe("/home/user/file.item");
  });

  test("Windows path se convierte a /mnt/c/...", () => {
    const result = toMcpPath("C:\\Users\\User\\file.item", wslContext);
    expect(result).toBe("/mnt/c/Users/User/file.item");
  });

  test("path sin formato Windows no se modifica", () => {
    expect(toMcpPath("/mnt/c/Users/file.item", wslContext)).toBe("/mnt/c/Users/file.item");
  });
});

describe("toTalendHostPath", () => {
  test("pathMode native no convierte", () => {
    expect(toTalendHostPath("/home/user/file.item", nativeContext)).toBe("/home/user/file.item");
  });

  test("/mnt/c/... se convierte a C:\\...", () => {
    const result = toTalendHostPath("/mnt/c/Users/User/file.item", wslContext);
    expect(result).toBe("C:\\Users\\User\\file.item");
  });

  test("path sin /mnt/ no se modifica", () => {
    expect(toTalendHostPath("/home/user/file.item", wslContext)).toBe("/home/user/file.item");
  });
});

describe("normalizeLogicalTalendFolderPath", () => {
  test("normaliza backslashes", () => {
    expect(normalizeLogicalTalendFolderPath("Process\\SubFolder")).toBe("Process/SubFolder");
  });

  test("limpia slashes iniciales y finales", () => {
    expect(normalizeLogicalTalendFolderPath("/Process/SubFolder/")).toBe("Process/SubFolder");
  });

  test("rechaza .. y .", () => {
    expect(() => normalizeLogicalTalendFolderPath("Process/../SubFolder")).toThrow();
    expect(() => normalizeLogicalTalendFolderPath("Process/./SubFolder")).toThrow();
  });

  test("string vacío para path vacío", () => {
    expect(normalizeLogicalTalendFolderPath("")).toBe("");
  });
});

describe("getBaseNamePortable", () => {
  test("extrae basename de path POSIX", () => {
    expect(getBaseNamePortable("/home/user/file.item")).toBe("file.item");
  });

  test("extrae basename de path Windows", () => {
    expect(getBaseNamePortable("C:\\Users\\User\\file.item")).toBe("file.item");
  });

  test("extrae basename de path mixto", () => {
    expect(getBaseNamePortable("C:/Users/User/file.item")).toBe("file.item");
  });
});

describe("getDirNamePortable", () => {
  test("extrae dirname de path POSIX", () => {
    expect(getDirNamePortable("/home/user/file.item")).toBe("/home/user");
  });

  test("extrae dirname de path Windows", () => {
    expect(getDirNamePortable("C:\\Users\\User\\file.item")).toBe("C:/Users/User");
  });
});

describe("splitPortable", () => {
  test("divide path POSIX", () => {
    expect(splitPortable("/a/b/c")).toEqual(["a", "b", "c"]);
  });

  test("divide path Windows", () => {
    expect(splitPortable("a\\b\\c")).toEqual(["a", "b", "c"]);
  });

  test("divide path mixto", () => {
    expect(splitPortable("a/b\\c")).toEqual(["a", "b", "c"]);
  });
});
