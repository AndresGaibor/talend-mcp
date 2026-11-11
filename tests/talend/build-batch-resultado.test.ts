import { describe, expect, test } from "bun:test";
import {
  CODIGO_SIN_ESTADO,
  avisoDeFaltantes,
  completarJobsFaltantes,
} from "../../src/talend/studio/build-batch-resultado";

/**
 * Un lote con `ok: true` y el mapa vacio no es un lote correcto: los Jobs pedidos
 * no compilaron, simplemente no llegaron al bridge.
 */

describe("resultado de un lote de compilacion", () => {
  test("si el bridge devuelve todos los Jobs, no cambia nada", () => {
    const cuerpo = { jobs: { job_uno: { ok: true }, job_dos: { ok: false } }, totalMs: 1200 };

    const resultado = completarJobsFaltantes(["job_uno", "job_dos"], cuerpo);

    expect(resultado.faltantes).toEqual([]);
    expect(resultado.cuerpo).toBe(cuerpo);
  });

  test("un mapa vacio deja todos los Jobs pedidos como no compilados", () => {
    const resultado = completarJobsFaltantes(["job_uno", "job_dos"], { jobs: {} });

    expect(resultado.faltantes).toEqual(["job_uno", "job_dos"]);
    const estados = resultado.cuerpo.jobs ?? {};
    expect(estados.job_uno?.ok).toBe(false);
    expect(estados.job_dos?.ok).toBe(false);
    const error = estados.job_uno?.error as { code?: string; message?: string };
    expect(error.code).toBe(CODIGO_SIN_ESTADO);
    expect(error.message).toContain("job_uno");
    expect(error.message).toContain("No se cuenta como compilado");
  });

  test("un Job que si vino conserva su estado", () => {
    const resultado = completarJobsFaltantes(["job_uno", "job_perdido"], {
      jobs: { job_uno: { ok: true } },
    });

    expect(resultado.faltantes).toEqual(["job_perdido"]);
    expect(resultado.cuerpo.jobs?.job_uno?.ok).toBe(true);
    expect(resultado.cuerpo.jobs?.job_perdido?.ok).toBe(false);
  });

  test("el aviso nombra los primeros faltantes y resume el resto", () => {
    const aviso = avisoDeFaltantes(["a", "b", "c", "d", "e", "f", "g"]);

    expect(aviso).toContain("7 Job(s)");
    expect(aviso).toContain("a, b, c, d, e");
    expect(aviso).toContain("y 2 mas");
    expect(avisoDeFaltantes([])).toBeUndefined();
  });
});
