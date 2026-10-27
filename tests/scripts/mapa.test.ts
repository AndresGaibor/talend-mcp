import { describe, expect, test } from "bun:test";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { DESCRIPCION_DE_CARPETAS, construirMapa } from "../../scripts/mapa";

const ROOT = join(import.meta.dir, "..", "..");
const DIRECTORIOS_LOCALES = new Set(["logs", "workspace"]);

describe("mapa del repo para agentes", () => {
  test("cada carpeta de primer nivel tiene descripcion: agregar una carpeta obliga a documentarla", () => {
    const sinDescripcion = readdirSync(ROOT)
      .filter((nombre) => !nombre.startsWith(".") && statSync(join(ROOT, nombre)).isDirectory())
      .filter((nombre) => !DIRECTORIOS_LOCALES.has(nombre))
      .filter((nombre) => !(nombre in DESCRIPCION_DE_CARPETAS));

    expect(sinDescripcion).toEqual([]);
  });

  test("las descripciones no quedan para carpetas que ya no existen", () => {
    const existentes = new Set(readdirSync(ROOT));
    const huerfanas = Object.keys(DESCRIPCION_DE_CARPETAS)
      .filter((nombre) => !DIRECTORIOS_LOCALES.has(nombre) && !existentes.has(nombre));

    expect(huerfanas).toEqual([]);
  });

  test("los presets son coherentes: agent y core son subconjuntos de all", async () => {
    const mapa = await construirMapa();
    const { all, agent, core } = mapa.tools.presets;

    expect(all).toBe(mapa.tools.total);
    expect(core).toBeDefined();
    expect(agent).toBeDefined();
    expect(core!).toBeLessThan(agent!);
    expect(agent!).toBeLessThan(all!);
    expect(core!).toBeGreaterThan(0);
  });

  test("lista los comandos del package.json que el repo documenta", async () => {
    const mapa = await construirMapa();

    expect(mapa.comandos).toContain("start");
    expect(mapa.comandos).toContain("mapa");
    expect(mapa.comandos).toContain("bridge:install");
  });
});
