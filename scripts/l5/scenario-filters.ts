import { execFileSync } from "node:child_process";

import { SCENARIO_ROOT } from "./scenario-files";
import type { Escenario } from "./scenario-types";

/**
 * Seleccion de escenarios por cambios en git.
 *
 * `--desde` solo necesita la version anterior de los archivos que cambiaron:
 * leer los 76 con un `git show` cada uno costaba decenas de procesos.
 */

export type CambiosOptions = {
  /** Repositorio donde consultar git (por defecto, el actual). */
  cwd?: string;
  /** Carpeta de escenarios dentro del repositorio. */
  root?: string;
};

/** Escenarios de un archivo: acepta una lista o un objeto con `escenarios`. */
export function parseEscenarios(text: string): Escenario[] {
  const parsed = JSON.parse(text.replace(/^\uFEFF/, "")) as Escenario[] | { escenarios: Escenario[] };
  return Array.isArray(parsed) ? parsed : parsed.escenarios;
}

function lineasDe(salida: string): string[] {
  return salida
    .split(/\r?\n/)
    .map((linea) => linea.trim())
    .filter(Boolean);
}

/**
 * Nombres de los escenarios cuyo archivo o contenido cambio desde `referencia`.
 *
 * Los escenarios de archivos sin cambios se consideran iguales; los de
 * archivos nuevos (no estaban en la referencia) cuentan como cambiados.
 */
export function nombresCambiadosDesde(
  referencia: string,
  actuales: Array<{ path: string; scenario: Escenario }>,
  options: CambiosOptions = {},
): Set<string> {
  const cwd = options.cwd ?? process.cwd();
  const root = options.root ?? SCENARIO_ROOT;
  const git = (args: string[]): string =>
    execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

  let enReferencia: Set<string>;
  let modificados: Set<string>;
  try {
    enReferencia = new Set(lineasDe(git(["ls-tree", "-r", "--name-only", referencia, "--", root])));
    modificados = new Set(
      lineasDe(git(["diff", "--name-only", "--no-renames", "--diff-filter=AM", referencia, "--", root])),
    );
  } catch (error) {
    throw new Error(`No se pudo leer ${root} en '${referencia}': ${error}`);
  }

  const versionAnterior = new Map<string, string>();
  for (const fichero of modificados) {
    try {
      for (const escenario of parseEscenarios(git(["show", `${referencia}:${fichero}`]))) {
        versionAnterior.set(`${fichero}\u0000${escenario.nombre}`, JSON.stringify(escenario));
      }
    } catch {
      // Archivo nuevo o renombrado: no hay version anterior que comparar.
    }
  }

  return new Set(
    actuales
      .filter((source) => {
        const path = source.path.replace(/\\/g, "/");
        if (!enReferencia.has(path)) return true;
        if (!modificados.has(path)) return false;
        return versionAnterior.get(`${path}\u0000${source.scenario.nombre}`) !== JSON.stringify(source.scenario);
      })
      .map((source) => source.scenario.nombre),
  );
}
