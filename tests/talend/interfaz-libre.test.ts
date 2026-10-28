import { expect, test } from "bun:test";
import { esperarInterfazLibre } from "../../src/talend/studio/interfaz-libre";

const sinPausa = async () => {};

test("devuelve en cuanto la interfaz responde", async () => {
  let consultas = 0;
  const bridge = { workbenchState: async () => { consultas++; return { ok: true } as never; } };

  expect(await esperarInterfazLibre(bridge, { pausa: sinPausa })).toBe(true);
  expect(consultas).toBe(1);
});

test("reintenta mientras la interfaz esta ocupada y termina cuando se libera", async () => {
  let consultas = 0;
  const bridge = {
    workbenchState: async () => {
      consultas++;
      if (consultas < 4) throw new Error("El hilo de la interfaz de Studio esta ocupado");
      return { ok: true } as never;
    },
  };

  expect(await esperarInterfazLibre(bridge, { pausa: sinPausa })).toBe(true);
  expect(consultas).toBe(4);
});

test("un ok:false tambien cuenta como ocupada", async () => {
  let consultas = 0;
  const bridge = { workbenchState: async () => ({ ok: ++consultas >= 3 }) as never };

  expect(await esperarInterfazLibre(bridge, { pausa: sinPausa })).toBe(true);
  expect(consultas).toBe(3);
});

test("un fallo que no es de interfaz ocupada no se reintenta", async () => {
  let consultas = 0;
  const bridge = { workbenchState: async () => { consultas++; throw new Error("bridge caido"); } };

  expect(await esperarInterfazLibre(bridge, { pausa: sinPausa })).toBe(false);
  expect(consultas).toBe(1);
});

test("se rinde tras los intentos maximos y no bloquea la operacion", async () => {
  let consultas = 0;
  const bridge = { workbenchState: async () => { consultas++; throw new Error("ocupado"); } };

  expect(await esperarInterfazLibre(bridge, { intentos: 5, pausa: sinPausa })).toBe(false);
  expect(consultas).toBe(5);
});
