import { describe, expect, test } from "bun:test";

import { margenDeMemoria } from "../../scripts/l5/studio-memoria";
import type { Bridge } from "../../scripts/l5/scenario-types";

/** Puente falso: cada llamada a `memory` devuelve el siguiente porcentaje de `lecturas`. */
function puenteCon(lecturas: number[]) {
  const pedidos: Array<{ gc?: boolean }> = [];
  const bridge = {
    memory: async (options?: { gc?: boolean }) => {
      pedidos.push(options ?? {});
      const usedPercent = lecturas.shift();
      return usedPercent === undefined ? { ok: false } : { ok: true, data: { usedPercent } };
    },
  } as unknown as Bridge;
  return { bridge, pedidos };
}

describe("margen de memoria de Studio", () => {
  test("con memoria libre no pide recoleccion", async () => {
    const { bridge, pedidos } = puenteCon([50]);
    const margen = await margenDeMemoria(bridge);
    expect(margen).toEqual({ usado: 50, hayMargen: true });
    expect(pedidos).toEqual([{}]);
  });

  test("si pasa el limite, pide recoleccion y sigue si la memoria baja", async () => {
    const { bridge, pedidos } = puenteCon([85, 60]);
    const margen = await margenDeMemoria(bridge);
    expect(margen).toEqual({ usado: 60, hayMargen: true });
    expect(pedidos).toEqual([{}, { gc: true }]);
  });

  test("se para si la recoleccion no basta", async () => {
    const { bridge } = puenteCon([90, 88]);
    expect(await margenDeMemoria(bridge)).toEqual({ usado: 88, hayMargen: false });
  });

  test("si no se puede medir, no bloquea la corrida", async () => {
    const { bridge } = puenteCon([]);
    expect(await margenDeMemoria(bridge)).toEqual({ usado: undefined, hayMargen: true });
  });
});
