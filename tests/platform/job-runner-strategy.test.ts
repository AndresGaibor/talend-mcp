import { test, expect, describe } from "bun:test";
import { detectJobRunnerStrategy, buildScriptExecutionArgs, selectScriptByPlatform, getScriptPathForExistsSync, executeJob } from "../../src/platform/job-runner-strategy";
import type { PlatformContext } from "../../src/platform/runtime";

const macContext: PlatformContext = { runtimeOs: "macos", talendHostOs: "macos", pathMode: "native" };
const winContext: PlatformContext = { runtimeOs: "windows", talendHostOs: "windows", pathMode: "native" };
const wslContext: PlatformContext = { runtimeOs: "wsl", talendHostOs: "windows", pathMode: "wsl-windows" };
const linuxContext: PlatformContext = { runtimeOs: "linux", talendHostOs: "linux", pathMode: "native" };

describe("detectJobRunnerStrategy", () => {
  test("macOS usa /bin/sh y posix", () => {
    const s = detectJobRunnerStrategy(macContext);
    expect(s.shell).toBe("/bin/sh");
    expect(s.preferredScriptPlatform).toBe("posix");
  });

  test("Windows usa cmd.exe y windows", () => {
    const s = detectJobRunnerStrategy(winContext);
    expect(s.shell).toBe("cmd.exe");
    expect(s.preferredScriptPlatform).toBe("windows");
  });

  test("WSL+Windows usa cmd.exe y windows (talendHostOs)", () => {
    const s = detectJobRunnerStrategy(wslContext);
    expect(s.shell).toBe("cmd.exe");
    expect(s.preferredScriptPlatform).toBe("windows");
  });

  test("Linux usa /bin/sh y posix", () => {
    const s = detectJobRunnerStrategy(linuxContext);
    expect(s.shell).toBe("/bin/sh");
    expect(s.preferredScriptPlatform).toBe("posix");
  });
});

describe("buildScriptExecutionArgs", () => {
  test("cmd.exe recibe /C + ruta", () => {
    const s = detectJobRunnerStrategy(winContext);
    const args = buildScriptExecutionArgs("C:\\script.bat", s, winContext);
    expect(args).toEqual(["/C", "C:\\script.bat"]);
  });

  test("/bin/sh recibe -c con chmod", () => {
    const s = detectJobRunnerStrategy(macContext);
    const args = buildScriptExecutionArgs("/path/script.sh", s, macContext);
    expect(args[0]).toBe("-c");
    expect(args[1]).toContain("chmod +x");
    expect(args[1]).toContain("script.sh");
  });
});

describe("selectScriptByPlatform", () => {
  const scripts = [
    { platform: "posix", scriptPath: "/path/script.sh" },
    { platform: "windows", scriptPath: "/path/script.bat" },
  ];

  test("macOS selecciona posix", () => {
    const s = detectJobRunnerStrategy(macContext);
    const result = selectScriptByPlatform(scripts, s);
    expect(result?.platform).toBe("posix");
  });

  test("Windows selecciona windows", () => {
    const s = detectJobRunnerStrategy(winContext);
    const result = selectScriptByPlatform(scripts, s);
    expect(result?.platform).toBe("windows");
  });

  test("fallback al primero si no hay match", () => {
    const s = detectJobRunnerStrategy(macContext);
    const onlyWindows = [{ platform: "windows", scriptPath: "/path/script.bat" }];
    const result = selectScriptByPlatform(onlyWindows, s);
    expect(result?.platform).toBe("windows");
  });
});

describe("WSL path conversion para existsSync", () => {
  test("C:\\... se convierte a /mnt/c/... para existsSync en WSL", () => {
    const wslCtx: PlatformContext = { runtimeOs: "wsl", talendHostOs: "windows", pathMode: "wsl-windows" };
    const winPath = "C:\\talend\\jobs\\test.bat";
    const mcpPath = getScriptPathForExistsSync(winPath, wslCtx);
    expect(mcpPath).toMatch(/^\/mnt\/c\/talend/);
  });
});
