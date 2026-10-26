import { describe, expect, test } from "bun:test";

import {
  compararConsulta,
  compararContextos,
  compararFichero,
  compararSalida,
} from "../../scripts/l5/scenario-expectations";

describe("comparacion con la salida esperada", () => {
  test("lineas exactas: avisa con lo esperado y lo que salio", () => {
    expect(compararSalida({ lineas: ["a", "b"] }, ["a", "b"])).toEqual([]);
    const fallos = compararSalida({ lineas: ["a", "b"] }, ["a", "c"]);
    expect(fallos).toHaveLength(1);
    expect(fallos[0]).toContain('se esperaba ["a","b"]');
    expect(fallos[0]).toContain('salio ["a","c"]');
  });

  test("numero de lineas y textos que tienen que aparecer", () => {
    expect(compararSalida({ lineas: 2 }, ["a", "b"])).toEqual([]);
    expect(compararSalida({ lineas: 3 }, ["a", "b"])).toEqual([
      "salieron 2 lineas y se esperaban 3",
    ]);
    expect(compararSalida({ contiene: ["hola", "adios"] }, ["hola mundo"])).toEqual([
      "no aparece 'adios' en la salida",
    ]);
  });

  test("fichero ausente, lineas exactas, cantidad y contenido", () => {
    expect(compararFichero({ ruta: "x.csv" }, null, "x.csv")).toEqual([
      "no se escribio el fichero x.csv: el job no lo ha creado. Revisa FILENAME del tFileOutputDelimited y que exista su carpeta de destino",
    ]);
    expect(compararFichero({ ruta: "x.csv", lineas: ["a"] }, ["a"], "x.csv")).toEqual([]);
    expect(compararFichero({ ruta: "x.csv", lineas: 1 }, ["a", "b"], "x.csv")).toEqual([
      "el fichero tiene 2 lineas y se esperaban 1",
    ]);
    expect(compararFichero({ ruta: "x.csv", contiene: ["total"] }, ["a"], "x.csv")).toEqual([
      "el fichero no contiene 'total'",
    ]);
  });

  test("consulta y contextos", () => {
    expect(compararConsulta({ sql: "select 1", valor: 1 }, 1)).toEqual([]);
    expect(compararConsulta({ sql: "select 1", valor: 1 }, null)).toEqual([
      "la consulta fallo: select 1",
    ]);
    expect(compararConsulta({ sql: "select 1", valor: 1 }, 2)).toEqual([
      "la consulta devolvio '2' y se esperaba '1'",
    ]);

    const esperados = [{ nombre: "Default", variables: [{ nombre: "pais", valor: "CO" }] }];
    expect(compararContextos(esperados, [])).toEqual(["el job no tiene el contexto 'Default'"]);
    expect(compararContextos(esperados, [{ name: "Default", parameters: [] }])).toEqual([
      "el contexto 'Default' no tiene la variable 'pais'",
    ]);
    expect(
      compararContextos(esperados, [
        { name: "Default", parameters: [{ name: "pais", value: "MX" }] },
      ]),
    ).toEqual(["en 'Default', 'pais' vale 'MX' y se esperaba 'CO'"]);
    expect(
      compararContextos(esperados, [
        { name: "Default", parameters: [{ name: "pais", value: "CO" }] },
      ]),
    ).toEqual([]);
  });
});
