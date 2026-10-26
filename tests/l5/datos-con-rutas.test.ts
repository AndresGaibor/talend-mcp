import { describe, expect, test } from "bun:test";

import { datosConRutas } from "../../scripts/l5/job-nodes";
import { CARPETA_TESTDATA } from "../../scripts/l5/testdata-paths";

/**
 * Las filas de datos de un componente tambien llevan rutas de `@TESTDATA@`. Si no se
 * sustituyen, Studio escribe en una carpeta literal `@TESTDATA@` dentro del repo.
 */
describe("filas de datos de los escenarios L5", () => {
  test("sustituye @TESTDATA@ en cada celda que lo lleve", () => {
    const filas = datosConRutas([["@TESTDATA@/salida.json", "cliente"]]);

    expect(filas[0]![0]).toBe(`${CARPETA_TESTDATA.replace(/\\/g, "/")}/salida.json`);
    expect(filas.flat().join("\n")).not.toContain("@TESTDATA@");
  });

  test("las celdas sin ruta no cambian", () => {
    const filas = datosConRutas([["uno", "dos"], ["", "3"]]);

    expect(filas).toEqual([["uno", "dos"], ["", "3"]]);
  });

  test("no muta las filas originales del escenario", () => {
    const original = [["@TESTDATA@/x.csv"]];

    datosConRutas(original);

    expect(original).toEqual([["@TESTDATA@/x.csv"]]);
  });
});
