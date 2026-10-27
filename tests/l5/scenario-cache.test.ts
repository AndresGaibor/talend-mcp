import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  escribirCache,
  estaProbado,
  huellaDe,
  huellaDeDefiniciones,
  huellaDeEscenario,
  leerCache,
  sembrarDesdeInforme,
  tiposDeComponentes,
} from "../../scripts/l5/scenario-cache";

const escenario = { nombre: "archivos: leer un JSON", job: "MCP_L5_Json" };

describe("huella de un escenario", () => {
  test("es estable para el mismo escenario y las mismas definiciones", () => {
    const a = huellaDeEscenario(escenario, "defs-1");
    const b = huellaDeEscenario({ ...escenario }, "defs-1");
    expect(a).toBe(b);
  });

  test("cambia si cambia el escenario o las definiciones de componentes", () => {
    const base = huellaDeEscenario(escenario, "defs-1");
    expect(huellaDeEscenario({ ...escenario, job: "MCP_L5_Otro" }, "defs-1")).not.toBe(base);
    expect(huellaDeEscenario(escenario, "defs-2")).not.toBe(base);
  });

  test("no confunde partes que se pegan: el separador evita colisiones", () => {
    expect(huellaDe(["ab", "c"])).not.toBe(huellaDe(["a", "bc"]));
  });
});

describe("cache de escenarios validados", () => {
  test("un escenario se considera validado solo con la misma huella", () => {
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

describe("componentes que usa un escenario", () => {
  test("incluye los de su job y los de sus jobs auxiliares, sin repetir", () => {
    const tipos = tiposDeComponentes({
      nodos: [{ type: "tMysqlRow" }, { type: "tLogRow" }, { type: "tMysqlRow" }],
      jobs: [{ nodos: [{ type: "tJava" }] }],
    });
    expect(tipos).toEqual(["tJava", "tLogRow", "tMysqlRow"]);
  });

  test("la huella de definiciones ignora los componentes que el escenario no usa", () => {
    const antes = new Map<string, unknown>([
      ["tLogRow", { version: "1" }],
      ["tFTPPut", { version: "1" }],
    ]);
    const despues = new Map<string, unknown>([
      ["tLogRow", { version: "1" }],
      ["tFTPPut", { version: "2" }],
    ]);
    const usados = ["tLogRow"];
    expect(huellaDeDefiniciones(usados, despues)).toBe(huellaDeDefiniciones(usados, antes));
    expect(huellaDeDefiniciones(["tFTPPut"], despues)).not.toBe(huellaDeDefiniciones(["tFTPPut"], antes));
  });
});

describe("sembrar la cache desde un informe", () => {
  const informe = Date.parse("2026-10-26T17:00:00.000Z");

  test("marca como probados los que no cambiaron despues del informe", () => {
    const cache = {};
    const agregados = sembrarDesdeInforme(
      cache,
      [
        { nombre: "viejo", huella: "h1", mtimeFichero: informe - 60_000 },
        { nombre: "editado", huella: "h2", mtimeFichero: informe + 60_000 },
      ],
      informe,
    );
    expect(agregados).toBe(1);
    expect(estaProbado(cache, "viejo", "h1")).toBe(true);
    expect(estaProbado(cache, "editado", "h2")).toBe(false);
  });

  test("no cuenta ni reescribe lo que ya estaba probado con la misma huella", () => {
    const cache = { viejo: { huella: "h1", fecha: "2026-10-26T00:00:00.000Z" } };
    const agregados = sembrarDesdeInforme(cache, [{ nombre: "viejo", huella: "h1", mtimeFichero: 0 }], informe);
    expect(agregados).toBe(0);
    expect(cache.viejo.fecha).toBe("2026-10-26T00:00:00.000Z");
  });
});
