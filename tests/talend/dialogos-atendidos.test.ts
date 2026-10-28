import { expect, test } from "bun:test";
import { conDialogosAtendidos } from "../../src/talend/studio/dialogos-atendidos";

const espera = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

test("atiende los dialogos mientras la operacion esta en curso y devuelve su resultado", async () => {
  let llamadas = 0;
  const bridge = { dismissDialogs: async () => { llamadas++; return { ok: true } as never; } };

  const resultado = await conDialogosAtendidos(bridge, async () => { await espera(60); return "listo"; }, 10);

  expect(resultado).toBe("listo");
  expect(llamadas).toBeGreaterThanOrEqual(2);
});

test("deja de atender al terminar la operacion", async () => {
  let llamadas = 0;
  const bridge = { dismissDialogs: async () => { llamadas++; return { ok: true } as never; } };

  await conDialogosAtendidos(bridge, async () => "rapido", 20);
  const alTerminar = llamadas;
  await espera(80);

  expect(llamadas).toBe(alTerminar);
});

test("un fallo del bridge al atender no rompe la operacion, y el error de la operacion se propaga", async () => {
  const bridge = { dismissDialogs: async () => { throw new Error("bridge caido"); } };

  expect(await conDialogosAtendidos(bridge, async () => { await espera(40); return 7; }, 10)).toBe(7);
  await expect(conDialogosAtendidos(bridge, async () => { throw new Error("fallo propio"); }, 10)).rejects.toThrow("fallo propio");
});
