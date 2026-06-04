import { test, expect, describe, mock } from "bun:test";
import { detectRuntimeOS, detectTalendHostOS, detectPathMode, createPlatformContext, isWsl } from "../../src/platform/runtime";

describe("detectRuntimeOS", () => {
  test("macos cuando platform es darwin", () => {
    Object.defineProperty(process, "platform", { value: "darwin" });
    expect(detectRuntimeOS()).toBe("macos");
  });

  test("windows cuando platform es win32", () => {
    Object.defineProperty(process, "platform", { value: "win32" });
    expect(detectRuntimeOS()).toBe("windows");
  });

  test("linux cuando platform es linux y no WSL", () => {
    Object.defineProperty(process, "platform", { value: "linux" });
    const origWsl = process.env.WSL_DISTRO_NAME;
    process.env.WSL_DISTRO_NAME = "";
    expect(detectRuntimeOS()).toBe("linux");
    if (origWsl) process.env.WSL_DISTRO_NAME = origWsl;
  });

  test("wsl cuando WSL_DISTRO_NAME está presente", () => {
    Object.defineProperty(process, "platform", { value: "linux" });
    const origWsl = process.env.WSL_DISTRO_NAME;
    process.env.WSL_DISTRO_NAME = "Ubuntu";
    expect(detectRuntimeOS()).toBe("wsl");
    if (origWsl) process.env.WSL_DISTRO_NAME = origWsl;
  });
});

describe("detectTalendHostOS", () => {
  test("usa env TALEND_HOST_OS cuando está presente", () => {
    expect(detectTalendHostOS("windows")).toBe("windows");
    expect(detectTalendHostOS("macos")).toBe("macos");
    expect(detectTalendHostOS("linux")).toBe("linux");
  });

  test("WSL runtime asume Talend en Windows", () => {
    Object.defineProperty(process, "platform", { value: "linux" });
    const origWsl = process.env.WSL_DISTRO_NAME;
    process.env.WSL_DISTRO_NAME = "Ubuntu";
    expect(detectTalendHostOS()).toBe("windows");
    if (origWsl) process.env.WSL_DISTRO_NAME = origWsl;
  });

  test("macOS runtime asume Talend en macOS", () => {
    Object.defineProperty(process, "platform", { value: "darwin" });
    expect(detectTalendHostOS()).toBe("macos");
  });

  test("Windows runtime asume Talend en Windows", () => {
    Object.defineProperty(process, "platform", { value: "win32" });
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
    Object.defineProperty(process, "platform", { value: "darwin" });
    const ctx = createPlatformContext();
    expect(ctx).toHaveProperty("runtimeOs");
    expect(ctx).toHaveProperty("talendHostOs");
    expect(ctx).toHaveProperty("pathMode");
  });

  test("acepta overrides via env", () => {
    Object.defineProperty(process, "platform", { value: "linux" });
    const origWsl = process.env.WSL_DISTRO_NAME;
    process.env.WSL_DISTRO_NAME = "Ubuntu";
    const ctx = createPlatformContext({ talendHostOs: "windows", pathMode: "wsl-windows" });
    expect(ctx.runtimeOs).toBe("wsl");
    expect(ctx.talendHostOs).toBe("windows");
    expect(ctx.pathMode).toBe("wsl-windows");
    if (origWsl) process.env.WSL_DISTRO_NAME = origWsl;
  });
});
