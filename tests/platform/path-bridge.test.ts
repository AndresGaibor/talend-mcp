import { test, expect, describe } from "bun:test";
import { toMcpPath, toTalendHostPath, toRuntimeShellPath, normalizeLogicalTalendFolderPath, normalizeLogicalTalendPath, getBaseNamePortable, getDirNamePortable, splitPortable } from "../../src/platform/path-bridge";
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

  test("Windows path C: se convierte a /mnt/c/...", () => {
    const result = toMcpPath("C:\\Users\\User\\workspace\\PROJECT", wslContext);
    expect(result).toBe("/mnt/c/Users/User/workspace/PROJECT");
  });

  test("Windows path D: se convierte a /mnt/d/...", () => {
    const result = toMcpPath("D:\\Talend\\Projects\\MyApp", wslContext);
    expect(result).toBe("/mnt/d/Talend/Projects/MyApp");
  });

  test("Windows path con forward slashes se normaliza", () => {
    const result = toMcpPath("C:/Users/User/workspace/PROJECT", wslContext);
    expect(result).toBe("/mnt/c/Users/User/workspace/PROJECT");
  });

  test("path ya convertido es idempotente", () => {
    expect(toMcpPath("/mnt/c/Users/User/file.item", wslContext)).toBe("/mnt/c/Users/User/file.item");
  });

  test("path con espacios se convierte correctamente", () => {
    const result = toMcpPath("C:\\Users\\User Name\\My Projects\\App", wslContext);
    expect(result).toBe("/mnt/c/Users/User Name/My Projects/App");
  });

  test("UNC paths se rechazan con error claro", () => {
    expect(() => toMcpPath("\\\\server\\share\\file.item", wslContext)).toThrow("Ruta UNC no soportada");
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

  test("/mnt/d/... se convierte a D:\\...", () => {
    const result = toTalendHostPath("/mnt/d/Talend/Projects/MyApp", wslContext);
    expect(result).toBe("D:\\Talend\\Projects\\MyApp");
  });

  test("path ya convertido es idempotente", () => {
    expect(toTalendHostPath("C:\\Users\\User\\file.item", wslContext)).toBe("C:\\Users\\User\\file.item");
  });

  test("path con espacios se convierte correctamente", () => {
    const result = toTalendHostPath("/mnt/c/Users/User Name/My Projects/App", wslContext);
    expect(result).toBe("C:\\Users\\User Name\\My Projects\\App");
  });

  test("path sin /mnt/ no se modifica", () => {
    expect(toTalendHostPath("/home/user/file.item", wslContext)).toBe("/home/user/file.item");
  });
});

describe("toRuntimeShellPath", () => {
  test("pathMode native no convierte", () => {
    expect(toRuntimeShellPath("/home/user/file.item", nativeContext)).toBe("/home/user/file.item");
  });

  test("/mnt/c/... se convierte a C:\\...", () => {
    const result = toRuntimeShellPath("/mnt/c/Users/User/workspace/PROJECT", wslContext);
    expect(result).toBe("C:\\Users\\User\\workspace\\PROJECT");
  });

  test("/mnt/d/... se convierte a D:\\...", () => {
    const result = toRuntimeShellPath("/mnt/d/Talend/Projects/MyApp", wslContext);
    expect(result).toBe("D:\\Talend\\Projects\\MyApp");
  });

  test("path ya convertido es idempotente", () => {
    expect(toRuntimeShellPath("C:\\Users\\User\\file.item", wslContext)).toBe("C:\\Users\\User\\file.item");
  });

  test("path con espacios se convierte correctamente", () => {
    const result = toRuntimeShellPath("/mnt/c/Users/User Name/My Projects/App", wslContext);
    expect(result).toBe("C:\\Users\\User Name\\My Projects\\App");
  });

  test("path sin /mnt/ no se modifica", () => {
    expect(toRuntimeShellPath("/home/user/file.item", wslContext)).toBe("/home/user/file.item");
  });
});

describe("normalizeLogicalTalendFolderPath", () => {
  test("normaliza backslashes", () => {
    expect(normalizeLogicalTalendFolderPath("Process\\SubFolder")).toBe("Process/SubFolder");
  });

  test("normaliza forward slashes", () => {
    expect(normalizeLogicalTalendFolderPath("Process/SubFolder")).toBe("Process/SubFolder");
  });

  test("normaliza path mixto", () => {
    expect(normalizeLogicalTalendFolderPath("Process\\SubFolder/Middle")).toBe("Process/SubFolder/Middle");
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

describe("normalizeLogicalTalendPath (alias)", () => {
  test("es alias de normalizeLogicalTalendFolderPath", () => {
    expect(normalizeLogicalTalendPath("Process\\SubFolder")).toBe(normalizeLogicalTalendFolderPath("Process\\SubFolder"));
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
