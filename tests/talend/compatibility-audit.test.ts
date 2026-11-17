import { describe, expect, test } from "bun:test";

import { buildCompatibilityReport, javaTestSummary } from "../../src/modules/studio-bridge/application/compatibility-audit";

describe("informe de compatibilidad de Studio", () => {
  test("resume el resultado Java sin copiar logs ni rutas locales", () => {
    expect(javaTestSummary("RESULT passed=18 failed=0\nC:\\private\\workspace", 0)).toEqual({
      ok: true,
      passed: 18,
      failed: 0,
      exitCode: 0,
    });
    expect(javaTestSummary("1 pass\n0 fail\nRan 1 test across 1 file.", 0)).toEqual({
      ok: true,
      passed: 1,
      failed: 0,
      exitCode: 0,
    });
    expect(javaTestSummary("FAIL no result", 1)).toEqual({ ok: false, exitCode: 1 });
  });

  test("el veredicto solo pasa si ping, capabilities y pruebas Java pasan", () => {
    const base = {
      testedAt: "2026-11-11T00:00:00.000Z",
      platform: "win32-x64",
      studioVersion: "8.0.1",
      bridge: { plugin: "bridge", version: "0.1.0", mode: "readWrite" },
      capabilities: { count: 1, names: ["build-batch"] },
      checks: [{ name: "bridge-ping", ok: true }, { name: "bridge-capabilities", ok: true }],
      javaTests: { ok: true, passed: 18, failed: 0, exitCode: 0 },
    };

    expect(buildCompatibilityReport(base).verdict).toBe("passed");
    expect(buildCompatibilityReport({ ...base, javaTests: { ok: false, exitCode: 1 } }).verdict).toBe("failed");
  });
});
