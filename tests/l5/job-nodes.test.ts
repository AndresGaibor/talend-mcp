import { describe, expect, test } from "bun:test";

import { parametrosDe, schemaDe } from "../../scripts/l5/job-nodes";
import { conRutas } from "../../scripts/l5/testdata-paths";

describe("nodos del job", () => {
  test("conRutas sustituye @TESTDATA@ por una ruta absoluta con barras normales", () => {
    const ruta = conRutas("@TESTDATA@/l5_clientes.csv");
    expect(ruta.endsWith("/testdata/l5_clientes.csv")).toBe(true);
    expect(ruta).not.toContain("\\");
  });

  test("parametrosDe resuelve rutas y @uniqueName, y respeta las tablas", () => {
    const parametros = parametrosDe(
      {
        type: "tPostgresqlInput",
        parameters: {
          "configuration.fileName": { value: "@TESTDATA@/l5_clientes.csv" },
          "configuration.connection": { value: "@uniqueName:conexion" },
          "configuration.desconocido": { value: "@uniqueName:otro" },
          "configuration.tabla": {
            value: [{ key: "a", value: "b" }],
            literal: true,
          },
        },
      },
      new Map([["conexion", "tPostgresqlConnection_1"]]),
    );

    expect(parametros?.["configuration.fileName"]?.value).toContain("/testdata/l5_clientes.csv");
    expect(parametros?.["configuration.connection"]?.value).toBe("tPostgresqlConnection_1");
    expect(parametros?.["configuration.desconocido"]?.value).toBe("@uniqueName:otro");
    expect(parametros?.["configuration.tabla"]?.value).toEqual([{ key: "a", value: "b" }]);
    expect(parametros?.["configuration.tabla"]?.literal).toBe(true);
  });

  test("parametrosDe devuelve undefined si el nodo no declara parametros", () => {
    expect(parametrosDe({ type: "tLogRow" }, new Map())).toBeUndefined();
  });

  test("schemaDe usa FLOW para el conector principal y los demas aparte", () => {
    const columnas = [{ name: "id", type: "id_Integer" }];
    expect(schemaDe({ type: "tLogRow", columnas }, "nodo_1")).toEqual([
      { connector: "FLOW", name: "nodo_1", columns: columnas },
    ]);
    expect(
      schemaDe({ type: "tUniqRow", columnasPorConector: { UNIQUE: columnas } }, "nodo_1"),
    ).toEqual([{ connector: "UNIQUE", name: "nodo_1", columns: columnas }]);
    expect(schemaDe({ type: "tLogRow" }, "nodo_1")).toEqual([]);
  });

  test("schemaDe respeta las tablas de varios conectores y @uniqueName", () => {
    const columnas = [{ name: "id", type: "id_Integer" }];
    expect(
      schemaDe(
        {
          type: "tAggregateRow",
          esquemas: [
            { conector: "FLOW", nombre: "row1", columnas },
            { conector: "FLOW", nombre: "@uniqueName", columnas },
          ],
        },
        "nodo_1",
      ),
    ).toEqual([
      { connector: "FLOW", name: "row1", columns: columnas },
      { connector: "FLOW", name: "nodo_1", columns: columnas },
    ]);
  });
});
