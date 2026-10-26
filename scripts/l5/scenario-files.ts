import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { validateScenario, type ScenarioIssue } from "./scenario-validation";

/**
 * Carga de los escenarios L5: un archivo por escenario, agrupados por suite.
 *
 *     tests/fixtures/talend/escenarios-l5/<suite>/<escenario>.json
 *
 * Con un archivo por escenario, el diff de un cambio muestra solo ese
 * escenario y una corrida con `--suite` lee unicamente la carpeta de esa suite:
 * no hace falta parsear las 76 historias para ejecutar una.
 */

export const SCENARIO_ROOT = "tests/fixtures/talend/escenarios-l5";

export type ScenarioSource<T> = {
  suite: string;
  /** Archivo dentro de la suite, por ejemplo `leer-csv.json`. */
  file: string;
  path: string;
  scenario: T;
};

export type ScenarioTree<T> = {
  root: string;
  /** Archivos leidos, en orden de suite y de nombre. */
  files: string[];
  /** Escenarios validos, en el mismo orden. */
  sources: ScenarioSource<T>[];
  scenarios: T[];
  issues: ScenarioIssue[];
};

export type LoadOptions = {
  /** Suite (carpeta) concreta; sin esto se leen todas. */
  suite?: string;
  root?: string;
};

export { type ScenarioIssue } from "./scenario-validation";

function safeReaddir(dir: string): string[] {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
  } catch {
    return [];
  }
}

/** Suites disponibles (carpetas con archivos de escenarios). */
export function suiteNames(root: string = SCENARIO_ROOT): string[] {
  return safeReaddir(root);
}

/** Nombres de los archivos de una suite, ordenados. */
export function scenarioFileNames(suite: string, root: string = SCENARIO_ROOT): string[] {
  const dir = join(root, suite);
  try {
    return readdirSync(dir)
      .filter((name) => name.endsWith(".json"))
      .sort();
  } catch {
    return [];
  }
}

export function scenarioPath(suite: string, file: string, root: string = SCENARIO_ROOT): string {
  return join(root, suite, file);
}

function readScenario(path: string): { value?: unknown; error?: string } {
  try {
    return { value: JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, "")) as unknown };
  } catch (error) {
    return { error: `JSON invalido: ${(error as Error).message}` };
  }
}

/**
 * Lee y valida los escenarios en una sola pasada.
 *
 * Los escenarios con problemas no se devuelven en `scenarios`: se listan en
 * `issues` para que el llamador corte antes de montar nada.
 */
export function loadScenarioTree<T>(options: LoadOptions = {}): ScenarioTree<T> {
  const root = options.root ?? SCENARIO_ROOT;
  const issues: ScenarioIssue[] = [];
  const sources: ScenarioSource<T>[] = [];
  const files: string[] = [];
  const entries: Array<{ suite: string; file: string; path: string; value: unknown }> = [];

  if (!existsSync(root)) {
    issues.push({ path: root, message: "no existe la carpeta de escenarios" });
    return { root, files, sources, scenarios: [], issues };
  }

  const suites = options.suite ? [options.suite] : suiteNames(root);
  if (options.suite && !existsSync(join(root, options.suite))) {
    issues.push({ path: join(root, options.suite), message: `no existe la suite "${options.suite}"` });
    return { root, files, sources, scenarios: [], issues };
  }

  for (const suite of suites) {
    for (const file of scenarioFileNames(suite, root)) {
      const path = scenarioPath(suite, file, root);
      files.push(path);

      const { value, error } = readScenario(path);
      if (error) {
        issues.push({ path, message: error });
        continue;
      }
      entries.push({ suite, file, path, value });
    }
  }

  // Un nombre repetido es un error del catalogo: el informe L5 usa el nombre
  // como clave, asi que ninguno de los dos se ejecuta.
  const porNombre = new Map<string, string[]>();
  for (const entry of entries) {
    const nombre = (entry.value as { nombre?: unknown } | null)?.nombre;
    if (typeof nombre !== "string") continue;
    porNombre.set(nombre, [...(porNombre.get(nombre) ?? []), entry.path]);
  }

  for (const entry of entries) {
    const problems = validateScenario(entry.value, { suite: entry.suite, path: entry.path });
    const nombre = (entry.value as { nombre?: unknown } | null)?.nombre;
    const repetidos = typeof nombre === "string" ? porNombre.get(nombre) ?? [] : [];
    if (repetidos.length > 1) {
      problems.push(
        `${entry.path}: nombre duplicado; "${nombre}" aparece en ${repetidos
          .filter((path) => path !== entry.path)
          .join(", ")}`,
      );
    }
    if (problems.length > 0) {
      for (const problem of problems) issues.push({ path: entry.path, message: problem });
      continue;
    }
    sources.push({
      suite: entry.suite,
      file: entry.file,
      path: entry.path,
      scenario: entry.value as T,
    });
  }

  return { root, files, sources, scenarios: sources.map((source) => source.scenario), issues };
}

/** Archivos de escenarios con su suite; por comodidad en las pruebas. */
export function scenarioFiles<T>(options: LoadOptions = {}): ScenarioSource<T>[] {
  return loadScenarioTree<T>(options).sources;
}
