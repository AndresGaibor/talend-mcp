import { describe, expect, test } from "bun:test";

/** Restaura una variable de entorno sin dejarla en la cadena "undefined". */
function restaurar(nombre: string, valor: string | undefined): void {
  if (valor === undefined) delete process.env[nombre];
  else process.env[nombre] = valor;
}

describe("Talend executor", () => {
  test("runJob devuelve error si no hay job activo (sin TALEND_PROJECT)", async () => {
    const originalDisableAutodetect = process.env.TALEND_DISABLE_AUTODETECT;
    process.env.TALEND_DISABLE_AUTODETECT = "1";

    try {
      const { runJob } = await import("../../src/talend/executor");

      const result = await runJob({ jobName: undefined as any, contextName: "Default" });

      expect(result.ok).toBe(false);
      expect(result.error).toContain("No se detectó TALEND_PROJECT");
    } finally {
      restaurar("TALEND_DISABLE_AUTODETECT", originalDisableAutodetect);
    }
  });

  test("runJob devuelve error si el job no existe", async () => {
    const original = process.env.TALEND_PROJECT;
    process.env.TALEND_PROJECT = "tests/fixtures/talend/workspace/CAPACITACION_GL3-1327321152/PRJ_GENIUS_LAB";

    try {
      const { runJob } = await import("../../src/talend/executor");
      const result = await runJob({ jobName: "job_inexistente_xyz", contextName: "Default" });

      expect(result.ok).toBe(false);
      expect(result.error).toContain("Job no encontrado");
    } finally {
      restaurar("TALEND_PROJECT", original);
    }
  });
});
