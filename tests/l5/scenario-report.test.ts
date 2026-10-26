import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, test } from "bun:test";

import {
  CABECERA_CSV,
  escaparCampo,
  escribirResultados,
  filaResultado,
  leerResultados,
  nombresFallidos,
  parsearLinea,
} from "../../scripts/l5/scenario-report";

const carpeta = mkdtempSync(join(tmpdir(), "talend-l5-report-"));
afterAll(() => rmSync(carpeta, { recursive: true, force: true }));

describe("informe CSV del arnes", () => {
  test("escapa comas, comillas y saltos de linea", () => {
    expect(escaparCampo("simple")).toBe("simple");
    expect(escaparCampo("con,coma")).toBe('"con,coma"');
    expect(escaparCampo('con "comillas"')).toBe('"con ""comillas"""');
    expect(escaparCampo("con\nsalto")).toBe('"con\nsalto"');
  });

  test("parsea una linea con campos entre comillas", () => {
    expect(parsearLinea('a,b,si,no,"detalle, con coma"')).toEqual([
      "a",
      "b",
      "si",
      "no",
      "detalle, con coma",
    ]);
    expect(parsearLinea('a,b,si,no,"dijo ""hola"""')).toEqual(["a", "b", "si", "no", 'dijo "hola"']);
  });

  test("la fila de un fallo sobrevive al ida y vuelta", () => {
    const linea = filaResultado(
      { nombre: "x: con,coma", job: "Job_X", nodos: [], conexiones: [] },
      { ejecutaOk: false, salidaCorrecta: false, mensaje: 'salieron 2 y se esperaba "3"' },
    );
    expect(parsearLinea(linea)).toEqual([
      "x: con,coma",
      "Job_X",
      "no",
      "no",
      'salieron 2 y se esperaba "3"',
    ]);
  });

  test("lee el informe anterior y conserva las filas que no se repitieron", () => {
    const ruta = join(carpeta, "resultados.csv");
    writeFileSync(
      ruta,
      `${CABECERA_CSV}\nuno,Job_1,si,si,"ok"\ndos,Job_2,no,no,"fallo, con coma"\n`,
      "utf8",
    );

    const filas = leerResultados(ruta);
    expect([...filas.keys()]).toEqual(["uno", "dos"]);
    expect(filas.get("dos")).toContain("fallo, con coma");

    const actualizado = new Map(filas);
    actualizado.set("dos", "dos,Job_2,si,si,ok");
    writeFileSync(ruta, `${[CABECERA_CSV, ...actualizado.values()].join("\n")}\n`, "utf8");
    expect([...leerResultados(ruta).keys()]).toEqual(["uno", "dos"]);
  });

  test("nombresFallidos lee solo las filas que no salieron bien", () => {
    const ruta = join(carpeta, "fallos.csv");
    escribirResultados(ruta, [
      "bien,Job_1,si,si,ok",
      "mal,Job_2,si,no,detalle",
      "no_ejecuto,Job_3,no,no,detalle",
    ]);

    expect([...nombresFallidos(ruta)].sort()).toEqual(["mal", "no_ejecuto"]);
    expect(() => nombresFallidos(join(carpeta, "no-existe.csv"))).toThrow(
      "No existe el informe anterior",
    );
  });

  test("escribirResultados deja la cabecera y una linea final", () => {
    const ruta = join(carpeta, "nuevo.csv");
    escribirResultados(ruta, ["uno,Job_1,si,si,ok"]);
    expect(leerResultados(ruta).size).toBe(1);
  });
});
