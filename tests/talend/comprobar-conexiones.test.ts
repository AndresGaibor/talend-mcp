import { describe, expect, test } from "bun:test";
import { comprobarConexiones } from "../../src/talend/job-batch/comprobar-conexiones";
import type { ComponentDefinition } from "../../src/modules/component-definitions/domain/component-definition.types";

const definicion = (name: string, connectors: Array<{ name: string; maxInput?: number; maxOutput?: number }>): ComponentDefinition =>
  ({ name, connectors: connectors.map((c) => ({ type: c.name, ...c })) }) as unknown as ComponentDefinition;

const DEFINICIONES: Record<string, ComponentDefinition> = {
  tFileInputDelimited: definicion("tFileInputDelimited", [{ name: "FLOW", maxInput: 0, maxOutput: 1 }]),
  tFilterRow: definicion("tFilterRow", [
    { name: "FLOW", maxInput: 1, maxOutput: 0 },
    { name: "FILTER", maxInput: 0, maxOutput: 1 },
    { name: "REJECT", maxInput: 0, maxOutput: 1 },
  ]),
  tLogRow: definicion("tLogRow", [{ name: "FLOW", maxInput: 1, maxOutput: 0 }]),
  tMap: definicion("tMap", [{ name: "FLOW", maxInput: 1, maxOutput: 1 }]),
};
const buscar = async (nombre: string) => DEFINICIONES[nombre] ?? null;

const componentes = [
  { uniqueName: "in_1", componentName: "tFileInputDelimited" },
  { uniqueName: "filter_2", componentName: "tFilterRow" },
  { uniqueName: "log_3", componentName: "tLogRow" },
  { uniqueName: "log_4", componentName: "tLogRow" },
  { uniqueName: "map_5", componentName: "tMap" },
];

describe("comprobarConexiones", () => {
  test("una cadena valida no da errores", async () => {
    const errores = await comprobarConexiones(
      {
        components: componentes,
        connections: [
          { source: "in_1", target: "filter_2", label: "row1", connectorName: "FLOW" },
          { source: "filter_2", target: "log_3", label: "row2", connectorName: "FILTER" },
          { source: "filter_2", target: "log_4", label: "row3", connectorName: "REJECT" },
        ],
      },
      buscar,
    );

    expect(errores).toEqual([]);
  });

  test("un conector que el origen no tiene es un error", async () => {
    const errores = await comprobarConexiones(
      { components: componentes, connections: [{ source: "log_3", target: "log_4", label: "row1", connectorName: "FLOW" }] },
      buscar,
    );

    expect(errores.join(" ")).toContain("no admite salidas");
  });

  test("dos conexiones de salida por un conector que admite una son un error", async () => {
    const errores = await comprobarConexiones(
      {
        components: componentes,
        connections: [
          { source: "in_1", target: "log_3", label: "row1", connectorName: "FLOW" },
          { source: "in_1", target: "log_4", label: "row2", connectorName: "FLOW" },
        ],
      },
      buscar,
    );

    expect(errores).toEqual(["'in_1' (tFileInputDelimited) admite 1 conexion(es) de salida por 'FLOW' y tiene 2"]);
  });

  test("dos conexiones de entrada a un conector que admite una son un error", async () => {
    const errores = await comprobarConexiones(
      {
        components: componentes,
        connections: [
          { source: "in_1", target: "log_3", label: "row1", connectorName: "FLOW" },
          { source: "filter_2", target: "log_3", label: "row2", connectorName: "FILTER" },
        ],
      },
      buscar,
    );

    expect(errores).toEqual(["'log_3' (tLogRow) admite 1 conexion(es) de entrada por 'FLOW' y tiene 2"]);
  });

  test("un tMap admite varias entradas y salidas por FLOW", async () => {
    const errores = await comprobarConexiones(
      {
        components: componentes,
        connections: [
          { source: "in_1", target: "map_5", label: "row1", connectorName: "FLOW" },
          { source: "filter_2", target: "map_5", label: "row2", connectorName: "FILTER" },
          { source: "map_5", target: "log_3", label: "out1", connectorName: "FLOW" },
          { source: "map_5", target: "log_4", label: "out2", connectorName: "FLOW" },
        ],
      },
      buscar,
    );

    expect(errores).toEqual([]);
  });

  test("los disparadores y los componentes sin definicion no se comprueban", async () => {
    const errores = await comprobarConexiones(
      {
        components: [...componentes, { uniqueName: "nuevo_6", componentName: "tComponenteNuevo" }],
        connections: [
          { source: "in_1", target: "log_3", label: "OnSubjobOk", connectorName: "SUBJOB_OK" },
          { source: "in_1", target: "nuevo_6", label: "row9", connectorName: "FLOW" },
        ],
      },
      buscar,
    );

    expect(errores).toEqual([]);
  });
});
