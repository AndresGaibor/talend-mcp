import { test, expect, describe, afterEach } from "bun:test";
import { detectRuntimeOS, detectTalendHostOS, detectPathMode, createPlatformContext, isWsl } from "../../src/platform/runtime";

const REAL_PLATFORM = process.platform;
const REAL_WSL_DISTRO = process.env.WSL_DISTRO_NAME;

/**
 * Estos tests simulan otro sistema operativo. `process.platform` y
 * `WSL_DISTRO_NAME` son globales, así que hay que restaurarlos siempre:
 * si quedan mutados, contaminan los archivos de test que se ejecutan después.
 */
afterEach(() => {
  Object.defineProperty(process, "platform", { value: REAL_PLATFORM });
  if (REAL_WSL_DISTRO === undefined) {
    delete process.env.WSL_DISTRO_NAME;
  } else {
    process.env.WSL_DISTRO_NAME = REAL_WSL_DISTRO;
  }
});

function setPlatform(value: NodeJS.Platform): void {
  Object.defineProperty(process, "platform", { value });
}

describe("detectRuntimeOS", () => {
  test("macos cuando platform es darwin", () => {
    setPlatform("darwin");
    expect(detectRuntimeOS()).toBe("macos");
  });

  test("windows cuando platform es win32", () => {
    setPlatform("win32");
    expect(detectRuntimeOS()).toBe("windows");
  });

  test("linux cuando platform es linux y no WSL", () => {
    setPlatform("linux");
    process.env.WSL_DISTRO_NAME = "";
    expect(detectRuntimeOS()).toBe("linux");
  });

  test("wsl cuando WSL_DISTRO_NAME está presente", () => {
    setPlatform("linux");
    process.env.WSL_DISTRO_NAME = "Ubuntu";
    expect(detectRuntimeOS()).toBe("wsl");
  });
});

describe("detectTalendHostOS", () => {
  test("usa env TALEND_HOST_OS cuando está presente", () => {
    expect(detectTalendHostOS("windows")).toBe("windows");
    expect(detectTalendHostOS("macos")).toBe("macos");
    expect(detectTalendHostOS("linux")).toBe("linux");
  });

  test("WSL runtime asume Talend en Windows", () => {
    setPlatform("linux");
    process.env.WSL_DISTRO_NAME = "Ubuntu";
    expect(detectTalendHostOS()).toBe("windows");
  });

  test("macOS runtime asume Talend en macOS", () => {
    setPlatform("darwin");
    expect(detectTalendHostOS()).toBe("macos");
  });

  test("Windows runtime asume Talend en Windows", () => {
    setPlatform("win32");
    expect(detectTalendHostOS()).toBe("windows");
  });
});

describe("detectPathMode", () => {
  test("env TALEND_PATH_MODE=vsl-windows", () => {
    expect(detectPathMode("wsl-windows")).toBe("wsl-windows");
  });

  test("env TALEND_PATH_MODE=native", () => {
    expect(detectPathMode("native")).toBe("native");
  });

  test("WSL + Windows Talend produce wsl-windows", () => {
    expect(detectPathMode(undefined, "wsl", "windows")).toBe("wsl-windows");
  });

  test("macOS + macOS Talend produce native", () => {
    expect(detectPathMode(undefined, "macos", "macos")).toBe("native");
  });
});

describe("createPlatformContext", () => {
  test("retorna estructura correcta", () => {
    setPlatform("darwin");
    const ctx = createPlatformContext();
    expect(ctx).toHaveProperty("runtimeOs");
    expect(ctx).toHaveProperty("talendHostOs");
    expect(ctx).toHaveProperty("pathMode");
  });

  test("acepta overrides via env", () => {
    setPlatform("linux");
    process.env.WSL_DISTRO_NAME = "Ubuntu";
    const ctx = createPlatformContext({ talendHostOs: "windows", pathMode: "wsl-windows" });
    expect(ctx.runtimeOs).toBe("wsl");
    expect(ctx.talendHostOs).toBe("windows");
    expect(ctx.pathMode).toBe("wsl-windows");
  });
});

describe("isWsl", () => {
  test("detecta WSL por variable de entorno", () => {
    setPlatform("linux");
    process.env.WSL_DISTRO_NAME = "Ubuntu";
    expect(isWsl()).toBe(true);
  });

  test("no detecta WSL en Windows nativo", () => {
    setPlatform("win32");
    delete process.env.WSL_DISTRO_NAME;
    expect(isWsl()).toBe(false);
  });
});
