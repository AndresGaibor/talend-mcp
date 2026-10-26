import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  escribirCache,
  estaProbado,
  huellaDe,
  huellaDeEscenario,
  huellaDelArnes,
  leerCache,
} from "../../scripts/l5/scenario-cache";

const escenario = { nombre: "archivos: leer un JSON", job: "MCP_L5_Json" };

describe("huella de un escenario", () => {
  test("es estable para el mismo escenario, arnes y contexto", () => {
    const a = huellaDeEscenario(escenario, "arnes-1", "contexto-1");
    const b = huellaDeEscenario({ ...escenario }, "arnes-1", "contexto-1");
    expect(a).toBe(b);
  });

  test("cambia si cambia el escenario, el arnes o el contexto de la corrida", () => {
    const base = huellaDeEscenario(escenario, "arnes-1", "contexto-1");
    expect(huellaDeEscenario({ ...escenario, job: "MCP_L5_Otro" }, "arnes-1", "contexto-1")).not.toBe(base);
    expect(huellaDeEscenario(escenario, "arnes-2", "contexto-1")).not.toBe(base);
    expect(huellaDeEscenario(escenario, "arnes-1", "contexto-2")).not.toBe(base);
  });

  test("no confunde partes que se pegan: el separador evita colisiones", () => {
    expect(huellaDe(["ab", "c"])).not.toBe(huellaDe(["a", "bc"]));
  });

  test("la huella del arnes es un sha256 y depende del codigo", () => {
    expect(huellaDelArnes()).toMatch(/^[0-9a-f]{64}$/);
    expect(huellaDelArnes()).toBe(huellaDelArnes());
  });
});

describe("cache de escenarios probados", () => {
  test("un escenario se considera probado solo con la misma huella", () => {
    const cache = { [escenario.nombre]: { huella: "h1", fecha: "2026-10-26T00:00:00.000Z" } };
    expect(estaProbado(cache, escenario.nombre, "h1")).toBe(true);
    expect(estaProbado(cache, escenario.nombre, "h2")).toBe(false);
    expect(estaProbado(cache, "otro escenario", "h1")).toBe(false);
  });

  test("sin fichero, la cache es vacia y no falla", () => {
    const carpeta = mkdtempSync(join(tmpdir(), "cache-l5-"));
    expect(leerCache(join(carpeta, "no-existe.json"))).toEqual({});
  });

  test("un fichero roto se trata como cache vacia", () => {
    const carpeta = mkdtempSync(join(tmpdir(), "cache-l5-"));
    const ruta = join(carpeta, "cache.json");
    writeFileSync(ruta, "{ esto no es json", "utf8");
    expect(leerCache(ruta)).toEqual({});
  });

  test("lo que se escribe se vuelve a leer igual", () => {
    const carpeta = mkdtempSync(join(tmpdir(), "cache-l5-"));
    const ruta = join(carpeta, "cache.json");
    const cache = { [escenario.nombre]: { huella: "h1", fecha: "2026-10-26T00:00:00.000Z" } };
    escribirCache(ruta, cache);
    expect(leerCache(ruta)).toEqual(cache);
    expect(JSON.parse(readFileSync(ruta, "utf8"))).toEqual(cache);
  });
});
