import { describe, expect, test } from "bun:test";
import { conTiempoLimite, CupoDeLlamadas, ToolTimeoutError } from "../../src/presentation/server/new-server/tool-guard";

/**
 * `tools/call` esperaba al handler sin plazo ni tope de concurrencia: una tool
 * colgada dejaba la peticion abierta y N llamadas abrian N procesos.
 */
describe("plazo de una tool", () => {
  test("devuelve el resultado cuando la tool termina a tiempo", async () => {
    const resultado = await conTiempoLimite("talend_prueba", 1_000, async () => "listo");

    expect(resultado).toBe("listo");
  });

  test("falla con ToolTimeoutError cuando la tool se pasa del plazo", async () => {
    const error = await conTiempoLimite("talend_lenta", 20, async () => {
      await new Promise((resolve) => setTimeout(resolve, 200));
      return "tarde";
    }).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(ToolTimeoutError);
    expect((error as ToolTimeoutError).toolName).toBe("talend_lenta");
    expect((error as ToolTimeoutError).message).toContain("20 ms");
  });

  test("un fallo tardio de la tool abandonada no rompe el proceso", async () => {
    const error = await conTiempoLimite("talend_falla_tarde", 10, async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      throw new Error("fallo tardio");
    }).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(ToolTimeoutError);
    // Se le da tiempo al rechazo tardio: si no estuviera capturado, bun lo reportaria.
    await new Promise((resolve) => setTimeout(resolve, 100));
  });
});

describe("cupo de llamadas simultaneas", () => {
  test("rechaza la llamada que pasa del maximo y la libera al salir", () => {
    const cupo = new CupoDeLlamadas(2);

    expect(cupo.intentarEntrar()).toBe(true);
    expect(cupo.intentarEntrar()).toBe(true);
    expect(cupo.activas).toBe(2);
    expect(cupo.intentarEntrar()).toBe(false);

    cupo.salir();
    expect(cupo.activas).toBe(1);
    expect(cupo.intentarEntrar()).toBe(true);
  });

  test("salir de mas no deja el contador en negativo", () => {
    const cupo = new CupoDeLlamadas(1);

    cupo.salir();
    cupo.salir();

    expect(cupo.activas).toBe(0);
  });
});
