import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  SCENARIO_ROOT,
  loadScenarioTree,
  scenarioFiles,
  suiteNames,
} from "../../scripts/l5/scenario-files";
import { KNOWN_SUITES, suiteOf } from "../../scripts/l5/scenario-selection";
import { validateScenario } from "../../scripts/l5/scenario-validation";

const temporales: string[] = [];

function tempRoot(): string {
  const dir = mkdtempSync(join(tmpdir(), "talend-l5-fixtures-"));
  temporales.push(dir);
  return dir;
}

function escribe(root: string, suite: string, file: string, contenido: unknown): string {
  const dir = join(root, suite);
  mkdirSync(dir, { recursive: true });
  const path = join(dir, file);
  writeFileSync(path, typeof contenido === "string" ? contenido : JSON.stringify(contenido, null, 2));
  return path;
}

afterAll(() => {
  for (const dir of temporales) rmSync(dir, { recursive: true, force: true });
});

describe("catalogo de escenarios L5", () => {
  const arbol = loadScenarioTree<{ nombre: string }>();

  test("todos los escenarios pasan la validacion", () => {
    expect(arbol.issues).toEqual([]);
    expect(arbol.scenarios.length).toBeGreaterThan(0);
  });

  test("cada escenario vive en su propio archivo", () => {
    expect(arbol.files.length).toBe(arbol.scenarios.length);
    for (const path of arbol.files) {
      const contenido = JSON.parse(readFileSync(path, "utf8")) as unknown;
      expect(Array.isArray(contenido)).toBe(false);
      expect(contenido).not.toHaveProperty("escenarios");
    }
  });

  test("el nombre del archivo identifica al escenario", () => {
    const repetidos = arbol.sources.filter((source) => {
      const contenido = JSON.parse(readFileSync(source.path, "utf8")) as { nombre?: unknown };
      return typeof contenido.nombre !== "string" || contenido.nombre !== source.scenario.nombre;
    });
    expect(repetidos.map((source) => source.path)).toEqual([]);
  });

  test("cada suite tiene su carpeta y los escenarios estan donde corresponde", () => {
    const suites = suiteNames();
    expect(suites.length).toBeGreaterThan(1);
    for (const suite of suites) expect(KNOWN_SUITES.has(suite) || suite === "otros").toBe(true);

    const fueraDeSitio = arbol.sources
      .filter((source) => {
        const suite = suiteOf(source.scenario.nombre);
        return suite !== "otros" && suite !== source.suite;
      })
      .map((source) => `${source.suite}/${source.file} -> ${source.scenario.nombre}`);
    expect(fueraDeSitio).toEqual([]);
  });
});

describe("carga por suite", () => {
  test("solo lee la carpeta de la suite pedida", () => {
    const root = tempRoot();
    escribe(root, "humo", "bueno.json", {
      nombre: "humo: uno",
      job: "MCP_L5_Uno",
      nodos: [{ type: "tLogRow", nombre: "salida" }],
    });
    escribe(root, "archivos", "roto.json", "{ esto no es json");

    const humo = loadScenarioTree({ root, suite: "humo" });
    expect(humo.issues).toEqual([]);
    expect(humo.scenarios).toHaveLength(1);

    const todo = loadScenarioTree({ root });
    expect(todo.scenarios).toHaveLength(1);
    expect(todo.issues).toHaveLength(1);
    expect(todo.issues[0]!.message).toContain("JSON invalido");
    expect(todo.issues[0]!.path.endsWith("roto.json")).toBe(true);
  });

  test("una suite inexistente se reporta como problema", () => {
    const root = tempRoot();
    escribe(root, "humo", "uno.json", {
      nombre: "humo: uno",
      job: "MCP_L5_Uno",
      nodos: [{ type: "tLogRow", nombre: "salida" }],
    });

    const arbol = loadScenarioTree({ root, suite: "calidad" });
    expect(arbol.scenarios).toEqual([]);
    expect(arbol.issues[0]!.message).toContain('no existe la suite "calidad"');
  });

  test("un escenario con problemas no se devuelve para ejecutar", () => {
    const root = tempRoot();
    escribe(root, "humo", "sin-job.json", {
      nombre: "humo: sin job",
      nodos: [{ type: "tLogRow", nombre: "salida" }],
    });
    escribe(root, "humo", "duplicado.json", {
      nombre: "humo: sin job",
      job: "MCP_L5_Dos",
      nodos: [{ type: "tLogRow", nombre: "salida" }],
    });

    const arbol = loadScenarioTree({ root });
    expect(arbol.scenarios).toEqual([]);
    expect(arbol.issues.length).toBeGreaterThanOrEqual(2);
    expect(arbol.issues.some((issue) => issue.message.includes('falta "job"'))).toBe(true);
    expect(arbol.issues.some((issue) => issue.message.includes("nombre duplicado"))).toBe(true);
  });

  test("scenarioFiles devuelve la suite y el archivo de cada escenario", () => {
    const root = tempRoot();
    escribe(root, "humo", "uno.json", {
      nombre: "humo: uno",
      job: "MCP_L5_Uno",
      nodos: [{ type: "tLogRow", nombre: "salida" }],
    });

    const [source] = scenarioFiles<{ nombre: string }>({ root });
    expect(source?.suite).toBe("humo");
    expect(source?.file).toBe("uno.json");
    expect(source?.scenario.nombre).toBe("humo: uno");
  });

  test("SCENARIO_ROOT apunta a la carpeta real del repo", () => {
    expect(SCENARIO_ROOT.endsWith("escenarios-l5")).toBe(true);
    expect(scenarioFiles().length).toBeGreaterThan(10);
  });
});

describe("validacion de un escenario", () => {
  const base = {
    nombre: "humo: base",
    job: "MCP_L5_Base",
    nodos: [{ type: "tLogRow", nombre: "salida" }],
  };

  test("un escenario completo no reporta nada", () => {
    expect(validateScenario(base, { suite: "humo" })).toEqual([]);
  });

  test("exige nombre, job y nodos", () => {
    expect(validateScenario({}, { path: "x.json" })).toEqual([
      'x.json: falta "nombre" (formato "categoria: descripcion")',
      'x.json: falta "job" con el nombre del job a montar',
      'x.json: falta "nodos" con al menos un componente',
    ]);
  });

  test("rechaza un nombre sin categoria y un nodo sin type", () => {
    const problemas = validateScenario({ ...base, nombre: "sin categoria", nodos: [{}] });
    expect(problemas.some((p) => p.includes("no tiene categoria"))).toBe(true);
    expect(problemas.some((p) => p.includes('nodos[0] no tiene "type"'))).toBe(true);
  });

  test("detecta un escenario guardado en la suite equivocada", () => {
    const problemas = validateScenario(base, { suite: "archivos", path: "archivos/base.json" });
    expect(problemas).toHaveLength(1);
    expect(problemas[0]).toContain('pertenece a la suite "humo"');
  });

  test("valida conexiones, espera y pendiente", () => {
    const problemas = validateScenario({
      ...base,
      conexiones: [{ origen: "a" }],
      espera: { lineas: "lineas", contiene: "texto", error_esperado: "no" },
      pendiente: "   ",
    });
    expect(problemas.some((p) => p.includes('conexiones[0] necesita "origen" y "destino"'))).toBe(true);
    expect(problemas.some((p) => p.includes('"espera.lineas" tiene que ser un numero o una lista de textos'))).toBe(true);
    expect(problemas.some((p) => p.includes('"espera.contiene" tiene que ser una lista de textos'))).toBe(true);
    expect(problemas.some((p) => p.includes('"espera.error_esperado" tiene que ser true o false'))).toBe(true);
    expect(problemas.some((p) => p.includes('"pendiente" tiene que explicar'))).toBe(true);
    expect(validateScenario({ ...base, espera: "lineas" }, { path: "x.json" })).toEqual([
      'x.json: "espera" tiene que ser un objeto con lo que se comprueba',
    ]);
  });

  test("detecta nodos sin nombre, nombres repetidos y conexiones a nodos inexistentes", () => {
    const problemas = validateScenario({
      ...base,
      nodos: [
        { type: "tLogRow" },
        { type: "tLogRow", nombre: "salida" },
        { type: "tLogRow", nombre: "salida" },
      ],
      conexiones: [
        { origen: "salida", destino: "fantasma" },
        { origen: "salida", destino: "salida" },
      ],
    });
    expect(problemas.some((p) => p.includes('nodos[0] ("tLogRow") no tiene "nombre"'))).toBe(true);
    expect(problemas.some((p) => p.includes('el nombre de nodo "salida" esta repetido'))).toBe(true);
    expect(problemas.some((p) => p.includes('destino inexistente: "fantasma"'))).toBe(true);
    expect(problemas.some((p) => p.includes('conecta "salida" consigo mismo'))).toBe(true);
  });

  test("un JSON que no es objeto se rechaza", () => {
    expect(validateScenario([base], { path: "lista.json" })).toEqual([
      "lista.json: tiene que ser un objeto JSON con los campos del escenario",
    ]);
  });
});
