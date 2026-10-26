import { describe, expect, test } from "bun:test";
import { desenvolver, lineasCsv } from "../../scripts/coverage/informe";
import { lineaDeProgreso, debeRecolectar, superaElLimite } from "../../scripts/coverage/progreso";
import { leerOpciones } from "../../scripts/coverage/opciones";
import { lineasDeFallos, lineasDeResumen } from "../../scripts/coverage/resumen";
import {
  componentesPedidos,
  elegirComponentes,
  filtrarDelCatalogo,
  pideArtefacto,
} from "../../scripts/coverage/seleccion";
import type {
  ComponentDefinition,
  DefinitionImport,
  DefinitionIndex,
} from "../../src/modules/component-definitions/domain/component-definition.types";

function definicion(
  name: string,
  families: string[] = [],
  imports: DefinitionImport[] = [],
  palette: ComponentDefinition["palette"] = "DI",
): ComponentDefinition {
  return {
    name,
    family: families[0] ?? "",
    families,
    startable: true,
    palette,
    pluginId: "org.talend.designer.components.localprovider",
    definitionPath: `/defs/${name}_java.xml`,
    parameters: [],
    requiredParameters: [],
    connectors: [],
    imports,
    returns: [],
  };
}

function indice(...components: ComponentDefinition[]): DefinitionIndex {
  return { version: 1, generatedAt: "", pluginsDir: "", components };
}

const montaje = { tFileInputDelimited: {}, tFileOutputDelimited: {}, tJoin: {} };

describe("opciones de coverage", () => {
  test("usa los valores por defecto", () => {
    const opciones = leerOpciones([]);
    expect(opciones.salida).toBe("testdata/cobertura.csv");
    expect(opciones.compilar).toBe(false);
    expect(opciones.soloPendientes).toBe(false);
    expect(opciones.max).toBeUndefined();
  });

  test("lee banderas con y sin valor", () => {
    const opciones = leerOpciones([
      "--family", "File/Input", "--max", "50", "--compile", "--out", "x.csv", "--solo-pendientes",
    ]);
    expect(opciones.familia).toBe("File/Input");
    expect(opciones.max).toBe(50);
    expect(opciones.compilar).toBe(true);
    expect(opciones.salida).toBe("x.csv");
    expect(opciones.soloPendientes).toBe(true);
  });

  test("ignora una bandera sin valor al final", () => {
    expect(leerOpciones(["--filter"]).filtro).toBeUndefined();
  });
});

describe("informe de cobertura", () => {
  test("desenvuelve la respuesta plana y la envuelta en result", () => {
    expect(desenvolver({ state: "running", tested: 2 })).toEqual({ state: "running", tested: 2 });
    expect(desenvolver({ result: { state: "done" } })).toEqual({ state: "done" });
    expect(desenvolver(undefined)).toEqual({});
  });

  test("escribe cabecera y escapa las comillas del error", () => {
    const lineas = lineasCsv([
      {
        component: "tFileInputDelimited",
        ok: false,
        parametersApplied: 3,
        saved: false,
        listed: true,
        deleted: false,
        mounted: 2,
        uniqueName: "tFileInputDelimited_1",
        error: 'fallo con "comillas"',
        compiles: true,
      },
    ]);
    expect(lineas[0]).toContain("componente,creado,configurado");
    expect(lineas[1]).toContain('"fallo con ""comillas"""');
    expect(lineas[1]).toContain("tFileInputDelimited,no,si,no,si,no,3,2");
    expect(lineas[1]?.endsWith(',si,""')).toBe(true);
  });

  test("deja vacia la columna de compilacion si no se midio", () => {
    const [, fila] = lineasCsv([{ component: "tJoin", ok: true }]);
    expect(fila?.split(",")[10]).toBe("");
  });
});

describe("resumen de cobertura", () => {
  const informe = { catalogSize: 897, tested: 10, created: 9, configured: 8, listed: 9, deleted: 9, failed: 1, saveFailed: 1 };

  test("incluye la linea L4 solo cuando se compilo", () => {
    expect(lineasDeResumen({ ...informe }, "x.csv", 5).join("\n")).not.toContain("Compilan (L4)");
    expect(lineasDeResumen({ ...informe, compile: true, compiled: 7 }, "x.csv", 5).join("\n")).toContain(
      "Compilan (L4):             7",
    );
  });

  test("marca la medicion cancelada y calcula los guardados", () => {
    const texto = lineasDeResumen({ ...informe, cancelled: true }, "x.csv", 5).join("\n");
    expect(texto).toContain("Probados:                  10 (cancelada)");
    expect(texto).toContain("Guardados sin error:       8");
  });

  test("lista solo los fallos y como maximo quince", () => {
    const filas = Array.from({ length: 20 }, (_, i) => ({ component: `c${i}`, ok: false, error: `e${i}` }));
    const lineas = lineasDeFallos(filas);
    expect(lineas.filter((linea) => linea.startsWith("  "))).toHaveLength(15);
    expect(lineasDeFallos([{ component: "ok", ok: true }])).toEqual([]);
  });
});

describe("progreso de la medicion", () => {
  test("recolecta entre el umbral y el limite", () => {
    expect(debeRecolectar(59)).toBe(false);
    expect(debeRecolectar(60)).toBe(true);
    expect(debeRecolectar(79)).toBe(true);
    expect(debeRecolectar(80)).toBe(false);
  });

  test("cancela al llegar al limite de memoria", () => {
    expect(superaElLimite(79)).toBe(false);
    expect(superaElLimite(80)).toBe(true);
  });

  test("formatea el avance con el componente actual", () => {
    const linea = lineaDeProgreso({ tested: 3, total: 10, failed: 1, current: "tJoin" }, 12, 45);
    expect(linea).toContain("3/10 componentes, 1 fallidos, 12 s, memoria 45%");
    expect(linea).toContain("tJoin");
  });
});

describe("seleccion de componentes", () => {
  test("parte la lista de --components y descarta vacios", () => {
    expect(componentesPedidos(" tJoin, tFilterRow ,, ")).toEqual(["tJoin", "tFilterRow"]);
  });

  test("solo cuenta artefactos obligatorios con coordenada Maven", () => {
    expect(pideArtefacto(definicion("a", [], [{ name: "x", mvn: "g/a/1", required: true }]))).toBe(true);
    expect(pideArtefacto(definicion("b", [], [{ name: "x", mvn: "g/a/1", required: false }]))).toBe(false);
    expect(pideArtefacto(definicion("c", [], [{ name: "x", required: true }]))).toBe(false);
  });

  test("filtra por familia sin distinguir mayusculas y solo componentes del plan", () => {
    const opciones = leerOpciones(["--family", "file/input"]);
    const elegidos = filtrarDelCatalogo(
      [
        definicion("tFileInputDelimited", ["File/Input"]),
        definicion("tFileOutputDelimited", ["File/Output"]),
        definicion("tFileInputXML", ["File/Input"]),
        definicion("tSparkInput", ["File/Input"], [], "SPARK"),
      ],
      montaje,
      opciones,
    );
    expect(elegidos).toEqual(["tFileInputDelimited"]);
  });

  test("omite los que piden artefactos con --sin-artefacto", () => {
    const opciones = leerOpciones(["--family", "File/Input", "--sin-artefacto"]);
    const elegidos = filtrarDelCatalogo(
      [
        definicion("tFileInputDelimited", ["File/Input"]),
        definicion("tFileInputXML", ["File/Input"], [{ name: "x", mvn: "g/a/1", required: true }]),
      ],
      montaje,
      opciones,
    );
    expect(elegidos).toEqual(["tFileInputDelimited"]);
  });

  test("respeta --components sin cargar el indice", async () => {
    const opciones = leerOpciones(["--components", "tJoin,tFilterRow"]);
    const elegidos = await elegirComponentes(opciones, montaje, {
      cargarIndice: () => {
        throw new Error("no deberia cargar el indice");
      },
      leerReportes: () => [],
    });
    expect(elegidos).toEqual(["tJoin", "tFilterRow"]);
  });

  test("con --con-definicion usa las claves del plan", async () => {
    const opciones = leerOpciones(["--con-definicion"]);
    const elegidos = await elegirComponentes(opciones, montaje, {
      cargarIndice: () => Promise.resolve(indice()),
      leerReportes: () => [],
    });
    expect(elegidos).toEqual(["tFileInputDelimited", "tFileOutputDelimited", "tJoin"]);
  });

  test("--solo-pendientes omite los verdes y conserva los fallidos", async () => {
    const opciones = leerOpciones(["--components", "tJoin,tFilterRow", "--solo-pendientes"]);
    const elegidos = await elegirComponentes(opciones, montaje, {
      cargarIndice: () => Promise.resolve(indice()),
      leerReportes: () => ["componente,compila\ntJoin,si\ntFilterRow,no"],
    });
    expect(elegidos).toEqual(["tFilterRow"]);
  });

  test("sin filtros mide el catalogo entero (lo decide el bridge)", async () => {
    const elegidos = await elegirComponentes(leerOpciones([]), montaje, {
      cargarIndice: () => Promise.resolve(indice()),
      leerReportes: () => [],
    });
    expect(elegidos).toBeUndefined();
  });
});
