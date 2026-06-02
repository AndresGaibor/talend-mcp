import { describe, expect, test } from "bun:test";

describe("Talend executor", () => {
  test("runJob devuelve error si no hay job activo (sin TALEND_PROJECT)", async () => {
    const originalDisableAutodetect = process.env.TALEND_DISABLE_AUTODETECT;
    process.env.TALEND_DISABLE_AUTODETECT = "1";

    const { runJob } = await import("../../src/talend/executor");

    const result = await runJob({ jobName: undefined as any, contextName: "Default" });

    process.env.TALEND_DISABLE_AUTODETECT = originalDisableAutodetect;

    expect(result.ok).toBe(false);
    expect(result.error).toContain("No se detectó TALEND_PROJECT");
  });

  test("runJob devuelve error si el job no existe", async () => {
    const original = process.env.TALEND_PROJECT;
    process.env.TALEND_PROJECT = "tests/fixtures/talend/workspace/CAPACITACION_GL3-1327321152/PRJ_GENIUS_LAB";

    const { runJob } = await import("../../src/talend/executor");
    const result = await runJob({ jobName: "job_inexistente_xyz", contextName: "Default" });

    process.env.TALEND_PROJECT = original;

    expect(result.ok).toBe(false);
    expect(result.error).toContain("Job no encontrado");
  });
});
