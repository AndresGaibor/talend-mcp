import { describe, expect, test } from "bun:test";
import { validateScenario } from "../../scripts/l5/scenario-validation";

const lector = {
  type: "tFileInputDelimited",
  nombre: "lector",
  parameters: { FILENAME: { value: "/datos/entrada.csv" } },
  columnas: [{ name: "id", type: "id_Integer" }],
};

const escritor = {
  type: "tFileOutputDelimited",
  nombre: "escritor",
  parameters: { FILENAME: { value: "/datos/salida.csv" } },
};

const conexiones = [
  { origen: "lector", destino: "mapeo" },
  { origen: "mapeo", destino: "escritor" },
];

const modeloValido = {
  inputs: [{ name: "row1", columns: [{ name: "id", type: "id_Integer" }] }],
  outputs: [{ name: "row2", columns: [{ name: "id", type: "id_Integer", expression: "row1.id" }] }],
};

function mapeo(mapper: unknown): Record<string, unknown> {
  return { type: "tMap", nombre: "mapeo", mapper };
}

function escenario(nodos: unknown[], lazos?: unknown[]): Record<string, unknown> {
  return {
    nombre: "transformaciones: prueba",
    job: "MCP_L5_Prueba",
    nodos,
    ...(lazos ? { conexiones: lazos } : {}),
  };
}

const opciones = { suite: "transformaciones" };

describe("tMap contra sus conexiones", () => {
  test("un tMap con una tabla por conexion no reporta nada", () => {
    expect(validateScenario(escenario([lector, mapeo(modeloValido), escritor], conexiones), opciones)).toEqual([]);
  });

  test("una salida que no es el nombre de ninguna conexion se detecta por el conteo", () => {
    const problemas = validateScenario(
      escenario([lector, mapeo({ inputs: modeloValido.inputs, outputs: [] }), escritor], conexiones),
      opciones,
    );

    expect(problemas.some((p) => p.includes('declara 0 salida(s) en mapper.outputs pero tiene 1 conexion(es) de salida'))).toBe(true);
  });

  test("mas tablas que conexiones se detecta por el conteo", () => {
    const problemas = validateScenario(
      escenario(
        [lector, mapeo({ inputs: modeloValido.inputs, outputs: [...modeloValido.outputs, { name: "row9", columns: [{ name: "id", type: "id_Integer" }] }] }), escritor],
        conexiones,
      ),
      opciones,
    );

    expect(problemas.some((p) => p.includes("declara 2 salida(s)"))).toBe(true);
  });

  test("una tabla sin columnas es sin esquema", () => {
    const problemas = validateScenario(
      escenario([lector, mapeo({ inputs: modeloValido.inputs, outputs: [{ name: "row2" }] }), escritor], conexiones),
      opciones,
    );

    expect(problemas.some((p) => p.includes('la salida "row2" del tMap "mapeo" no tiene columns: sin esquema'))).toBe(true);
  });

  test("una entrada sin columnas tambien es sin esquema", () => {
    const problemas = validateScenario(
      escenario([lector, mapeo({ inputs: [{ name: "row1", columns: [] }], outputs: modeloValido.outputs }), escritor], conexiones),
      opciones,
    );

    expect(problemas.some((p) => p.includes('la entrada "row1" del tMap "mapeo" no tiene columns'))).toBe(true);
  });

  test("una tabla sin name no se puede emparejar con una conexion", () => {
    const problemas = validateScenario(
      escenario([lector, mapeo({ inputs: modeloValido.inputs, outputs: [{ columns: modeloValido.outputs[0]!.columns }] }), escritor], conexiones),
      opciones,
    );

    expect(problemas.some((p) => p.includes('mapper.outputs[0] de "mapeo" no tiene "name"'))).toBe(true);
  });

  test("dos tablas con el mismo nombre se rechazan", () => {
    const problemas = validateScenario(
      escenario(
        [lector, mapeo({ inputs: modeloValido.inputs, outputs: [modeloValido.outputs[0], modeloValido.outputs[0]] }), escritor],
        conexiones,
      ),
      opciones,
    );

    expect(problemas.some((p) => p.includes('repite la tabla "row2"'))).toBe(true);
  });

  test("un tMap sin mapper no tiene modelo", () => {
    const problemas = validateScenario(escenario([lector, { type: "tMap", nombre: "mapeo" }, escritor], conexiones), opciones);

    expect(problemas.some((p) => p.includes('"mapeo" (tMap) no tiene "mapper"'))).toBe(true);
  });

  test("las variables van en name, type y expression, no en columns", () => {
    const conVarsValidas = { ...modeloValido, vars: [{ name: "v", type: "id_String", expression: "'x'" }] };
    expect(validateScenario(escenario([lector, mapeo(conVarsValidas), escritor], conexiones), opciones)).toEqual([]);

    const conColumns = { ...modeloValido, vars: [{ name: "v", columns: [] }] };
    const problemas = validateScenario(escenario([lector, mapeo(conColumns), escritor], conexiones), opciones);
    expect(problemas.some((p) => p.includes('la variable "v" del tMap "mapeo" usa "columns"'))).toBe(true);
  });
});

describe("componentes de fichero delimitado", () => {
  test("un tFileInputDelimited sin FILENAME dice que el job no compila y como arreglarlo", () => {
    const sinFichero = { ...lector, parameters: {} };
    const problemas = validateScenario(escenario([sinFichero, escritor], [{ origen: "lector", destino: "escritor" }]), opciones);

    expect(problemas.some((p) => p.includes('"lector" (tFileInputDelimited) no tiene FILENAME'))).toBe(true);
    expect(problemas.some((p) => p.includes("The constructor File() is undefined"))).toBe(true);
  });

  test("un FILENAME vacio cuenta como ausente", () => {
    const vacio = { ...escritor, parameters: { FILENAME: { value: "   " } } };
    const problemas = validateScenario(escenario([lector, vacio], [{ origen: "lector", destino: "escritor" }]), opciones);

    expect(problemas.some((p) => p.includes('"escritor" (tFileOutputDelimited) no tiene FILENAME'))).toBe(true);
  });

  test("un tFileInputDelimited sin columnas es sin esquema", () => {
    const sinEsquema = { ...lector, columnas: [] };
    const problemas = validateScenario(escenario([sinEsquema, escritor], [{ origen: "lector", destino: "escritor" }]), opciones);

    expect(problemas.some((p) => p.includes('"lector" (tFileInputDelimited) no tiene columnas: sin esquema'))).toBe(true);
  });

  test("el esquema puede ir en esquemas (tabla FLOW) en vez de en columnas", () => {
    const enEsquemas = {
      type: "tFileInputDelimited",
      nombre: "lector",
      parameters: { FILENAME: { value: "/datos/entrada.csv" } },
      esquemas: [{ conector: "FLOW", nombre: "@uniqueName", columnas: [{ name: "id", type: "id_Integer" }] }],
    };
    const problemas = validateScenario(escenario([enEsquemas, escritor], [{ origen: "lector", destino: "escritor" }]), opciones);

    expect(problemas.some((p) => p.includes("no tiene columnas"))).toBe(false);
  });

  test("un tFileOutputDelimited sin entrada no recibe filas", () => {
    const problemas = validateScenario(escenario([lector, escritor], []), opciones);

    expect(problemas.some((p) => p.includes('"escritor" (tFileOutputDelimited) no tiene entrada'))).toBe(true);
  });

  test("sin conexiones declaradas no se exige entrada al escritor", () => {
    const problemas = validateScenario(escenario([lector, escritor]), opciones);

    expect(problemas.some((p) => p.includes("no tiene entrada"))).toBe(false);
  });
});
