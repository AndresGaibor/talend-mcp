import { describe, expect, test } from "bun:test";
import { normalizarComponente } from "../../src/modules/component-definitions/application/normalizar-parametros";
import type { ComponentDefinition } from "../../src/modules/component-definitions/domain/component-definition.types";

/** tFilterRow como lo declara Studio: LOGICAL_OP con nombre y valor distintos, y la tabla CONDITIONS. */
const FILTRO = {
  name: "tFilterRow",
  parameters: [
    {
      name: "LOGICAL_OP",
      field: "CLOSED_LIST",
      required: true,
      show: true,
      advanced: false,
      defaultValue: "&&",
      options: [
        { name: "OR", value: "||" },
        { name: "AND", value: "&&" },
      ],
    },
    { name: "USE_ADVANCED", field: "CHECK", required: false, show: true, advanced: false, defaultValue: "false" },
    { name: "FILENAME", field: "FILE", required: false, show: true, advanced: false },
    {
      name: "CONDITIONS",
      field: "TABLE",
      required: false,
      show: true,
      advanced: false,
      table: {
        basedOnSchema: false,
        rows: 3,
        columns: [
          { name: "INPUT_COLUMN" },
          {
            name: "FUNCTION",
            options: [
              { name: "EMPTY", value: "" },
              { name: "LC", value: "LC" },
            ],
            defaultValue: "",
          },
          {
            name: "OPERATOR",
            options: [
              { name: "EQUAL", value: "==" },
              { name: "GREATER", value: ">" },
            ],
            defaultValue: "==",
          },
          { name: "RVALUE" },
        ],
      },
    },
  ],
} as unknown as ComponentDefinition;

describe("normalizarComponente", () => {
  test("traduce el nombre de un elemento de lista a su valor y toma el tipo de campo de la definicion", () => {
    const { parameters, avisos } = normalizarComponente(FILTRO, {
      parameters: { LOGICAL_OP: "AND", USE_ADVANCED: "false", FILENAME: '"datos.csv"' },
    });

    expect(parameters).toEqual([
      { name: "LOGICAL_OP", value: "&&", field: "CLOSED_LIST" },
      { name: "USE_ADVANCED", value: "false", field: "CHECK" },
      { name: "FILENAME", value: '"datos.csv"', field: "FILE" },
    ]);
    expect(avisos).toEqual([]);
  });

  test("un valor que ya es el de la lista se deja y uno que no esta se avisa", () => {
    const ya = normalizarComponente(FILTRO, { parameters: { LOGICAL_OP: "||" } });
    const malo = normalizarComponente(FILTRO, { parameters: { LOGICAL_OP: "XOR" } });

    expect(ya.parameters[0]).toEqual({ name: "LOGICAL_OP", value: "||", field: "CLOSED_LIST" });
    expect(malo.parameters[0]!.value).toBe("XOR");
    expect(malo.avisos.join(" ")).toContain("XOR");
  });

  test("omite con aviso un parametro que el componente no declara", () => {
    const { parameters, avisos } = normalizarComponente(FILTRO, { parameters: { NO_EXISTE: "x", LOGICAL_OP: "OR" } });

    expect(parameters.map((p) => p.name)).toEqual(["LOGICAL_OP"]);
    expect(avisos.join(" ")).toContain("NO_EXISTE");
  });

  test("un campo explicito de la plantilla manda sobre el de la definicion", () => {
    const { parameters } = normalizarComponente(FILTRO, { parameters: { FILENAME: { value: "a", field: "TEXT" } } });

    expect(parameters[0]).toEqual({ name: "FILENAME", value: "a", field: "TEXT" });
  });

  test("convierte las filas de una tabla en celdas y traduce las listas de sus columnas", () => {
    const { tables, avisos } = normalizarComponente(FILTRO, {
      tables: {
        CONDITIONS: {
          columns: ["INPUT_COLUMN", "FUNCTION", "OPERATOR", "RVALUE"],
          rows: [{ INPUT_COLUMN: "credit_limit", FUNCTION: "", OPERATOR: "GREATER", RVALUE: "0" }],
        },
      },
    });

    expect(avisos).toEqual([]);
    expect(tables).toEqual([
      {
        name: "CONDITIONS",
        cells: [
          { ref: "INPUT_COLUMN", value: "credit_limit" },
          { ref: "FUNCTION", value: "" },
          { ref: "OPERATOR", value: ">" },
          { ref: "RVALUE", value: "0" },
        ],
      },
    ]);
  });

  test("las filas pueden ser listas alineadas con las columnas y las celdas que faltan toman el valor por defecto", () => {
    const { tables } = normalizarComponente(FILTRO, {
      tables: { CONDITIONS: { columns: ["INPUT_COLUMN", "RVALUE"], rows: [["edad", "18"]] } },
    });

    expect(tables[0]!.cells).toEqual([
      { ref: "INPUT_COLUMN", value: "edad" },
      { ref: "FUNCTION", value: "" },
      { ref: "OPERATOR", value: "==" },
      { ref: "RVALUE", value: "18" },
    ]);
  });

  test("una tabla que el componente no declara se omite con aviso", () => {
    const { tables, avisos } = normalizarComponente(FILTRO, { tables: { OTRA: { rows: [["a"]] } } });

    expect(tables).toEqual([]);
    expect(avisos.join(" ")).toContain("OTRA");
  });

  test("sin definicion los parametros pasan tal cual y se avisa", () => {
    const { parameters, avisos } = normalizarComponente(null, { parameters: { A: "1" } }, "tRaro");

    expect(parameters).toEqual([{ name: "A", value: "1", field: "TEXT" }]);
    expect(avisos.join(" ")).toContain("tRaro");
  });
});

describe("listas que no se pidieron", () => {
  const CON_DEFECTO = {
    name: "tFilterRow",
    parameters: [
      {
        name: "LOGICAL_OP", field: "CLOSED_LIST", required: true, show: true, advanced: false, defaultOption: "AND",
        options: [{ name: "OR", value: "||" }, { name: "AND", value: "&&" }],
      },
      {
        name: "LINK_STYLE", field: "CLOSED_LIST", required: false, show: true, advanced: false, defaultOption: "",
        options: [{ name: "AUTO", value: "AUTO" }, { name: "LINE", value: "LINE" }],
      },
      { name: "TEXTO", field: "TEXT", required: false, show: true, advanced: false, defaultValue: '"x"' },
    ],
  } as unknown as ComponentDefinition;

  test("se escribe el valor por defecto de cada lista cerrada, traducido de nombre a valor", () => {
    const { parameters } = normalizarComponente(CON_DEFECTO, { parameters: {} });

    expect(parameters).toContainEqual({ name: "LOGICAL_OP", value: "&&", field: "CLOSED_LIST" });
  });

  test("una lista cuyo defecto esta vacio toma su primer elemento, como la interfaz", () => {
    const { parameters } = normalizarComponente(CON_DEFECTO, { parameters: {} });

    expect(parameters).toContainEqual({ name: "LINK_STYLE", value: "AUTO", field: "CLOSED_LIST" });
  });

  test("no se pisa lo que se pidio ni se escriben los parametros que no son listas", () => {
    const { parameters } = normalizarComponente(CON_DEFECTO, { parameters: { LOGICAL_OP: "OR" } });

    expect(parameters.filter((p) => p.name === "LOGICAL_OP")).toEqual([{ name: "LOGICAL_OP", value: "||", field: "CLOSED_LIST" }]);
    expect(parameters.some((p) => p.name === "TEXTO")).toBe(false);
  });
});
