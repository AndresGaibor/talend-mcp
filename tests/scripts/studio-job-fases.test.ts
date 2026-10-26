import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";

import { COMANDOS, FASES, comandoConocido } from "../../scripts/studio-job/fases";

const CARPETA = join(import.meta.dir, "..", "..", "scripts", "studio-job");

describe("comandos de studio-job", () => {
  test("reconoce los comandos simples y las fases registradas", () => {
    for (const comando of [...COMANDOS, ...Object.keys(FASES)]) {
      expect(comandoConocido(comando)).toBe(true);
    }
    expect(comandoConocido("fase99")).toBe(false);
    expect(comandoConocido("crear")).toBe(false);
  });

  test("cada fase registrada resuelve un modulo con su funcion por defecto", async () => {
    for (const [nombre, cargar] of Object.entries(FASES)) {
      const modulo = await cargar();
      expect(nombre.startsWith("fase")).toBe(true);
      expect(typeof modulo.default).toBe("function");
    }
  });

  test("no queda ningun archivo de fase sin registrar", () => {
    const archivos = readdirSync(CARPETA)
      .filter((archivo) => /^fase\d.*\.ts$/.test(archivo))
      .map((archivo) => archivo.replace(/\.ts$/, ""))
      .sort();
    expect(archivos).toEqual(Object.keys(FASES).sort());
  });
});
