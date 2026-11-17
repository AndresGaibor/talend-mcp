/**
 * Estado del candado de cierre: huella del arbol, pasos validados e historial.
 *
 * `scripts/verificar.ts` registra cada paso; el gancho `.githooks/pre-commit` llama a `exigir`.
 * La huella cubre el commit base, cada archivo modificado y cada archivo sin seguimiento, con el
 * hash de su contenido. Editar un archivo despues de validar invalida el cierre aunque `git status`
 * muestre el mismo nombre. Los archivos ignorados (`.talend-mcp`, `logs`, `node_modules`) no cuentan.
 */

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

export const REPO = join(import.meta.dir, "..", "..");
export const PASOS_OBLIGATORIOS = ["typecheck", "tests", "l5"] as const;
const NOMBRE_ESTADO = "estado.json";
const NOMBRE_HISTORIAL = "historial.jsonl";

export interface PasoEstado {
  ok: boolean;
  fecha: string;
  resumen: string;
}

export interface Estado {
  huella: string;
  commit: string;
  fecha: string;
  pasos: Record<string, PasoEstado>;
}

export interface Evaluacion {
  permitido: boolean;
  motivo: string;
  huella: string;
  pasos: Record<string, PasoEstado>;
}

export function directorio(base?: string): string {
  return base ?? join(REPO, ".talend-mcp", "validacion");
}

export function ahora(): string {
  return new Date().toISOString();
}

function git(repo: string, ...args: string[]): { ok: boolean; salida: string; error: string } {
  const proceso = spawnSync("git", args, { cwd: repo, encoding: "utf8" });
  return {
    ok: proceso.status === 0,
    salida: String(proceso.stdout ?? "").trim(),
    error: String(proceso.stderr ?? "").trim(),
  };
}

export function commitBase(repo: string): string {
  const proceso = git(repo, "rev-parse", "--verify", "HEAD");
  return proceso.ok ? proceso.salida : "";
}

function existeArchivo(ruta: string): boolean {
  try {
    return existsSync(ruta) && statSync(ruta).isFile();
  } catch {
    return false;
  }
}

function hashArchivo(ruta: string): string {
  try {
    return createHash("sha256").update(readFileSync(ruta)).digest("hex");
  } catch {
    return "<ilegible>";
  }
}

/** Hash estable de lo que se commitearia: HEAD mas el contenido de cada cambio. */
export function huellaArbol(repo = REPO): string {
  const estado = spawnSync(
    "git",
    ["status", "--porcelain=v1", "-z", "--untracked-files=all", "--no-renames"],
    { cwd: repo, encoding: "utf8" },
  );
  if (estado.status !== 0) {
    throw new Error(String(estado.stderr ?? "").trim() || "git status fallo");
  }
  const partes = [`base:${commitBase(repo)}`];
  for (const entrada of String(estado.stdout ?? "").split("\0")) {
    if (entrada.length < 4) continue;
    // Formato `XY ruta`: los dos primeros caracteres son el estado y el tercero es el espacio.
    const codigo = entrada.slice(0, 2);
    const ruta = entrada.slice(3);
    const archivo = join(repo, ruta);
    const contenido =
      codigo.includes("D") || !existeArchivo(archivo) ? "<ausente>" : hashArchivo(archivo);
    partes.push(`${codigo}:${ruta}:${contenido}`);
  }
  partes.sort();
  return createHash("sha256").update(partes.join("\n")).digest("hex");
}

export function leerEstado(base?: string): Partial<Estado> {
  try {
    return JSON.parse(readFileSync(join(directorio(base), NOMBRE_ESTADO), "utf8")) as Estado;
  } catch {
    return {};
  }
}

export function escribirEstado(estado: Estado, base?: string): void {
  const carpeta = directorio(base);
  mkdirSync(carpeta, { recursive: true });
  writeFileSync(join(carpeta, NOMBRE_ESTADO), JSON.stringify(estado, null, 2), "utf8");
}

export function rutaHistorial(base?: string): string {
  return join(directorio(base), NOMBRE_HISTORIAL);
}

export function anotar(evento: Record<string, unknown>, base?: string): void {
  const carpeta = directorio(base);
  mkdirSync(carpeta, { recursive: true });
  appendFileSync(rutaHistorial(base), `${JSON.stringify(evento)}\n`, "utf8");
}

/**
 * Anota el resultado de un paso para el arbol actual.
 *
 * Si el arbol cambio desde la ultima anotacion, el estado se reinicia: una validacion vieja no
 * autoriza un commit nuevo.
 */
export function registrar(
  paso: string,
  ok: boolean,
  resumen = "",
  opciones: { repo?: string; base?: string; huella?: string } = {},
): Estado {
  const repo = opciones.repo ?? REPO;
  const actual = opciones.huella ?? huellaArbol(repo);
  const anterior = leerEstado(opciones.base);
  const estado: Estado =
    anterior.huella === actual
      ? { huella: actual, commit: anterior.commit ?? "", fecha: ahora(), pasos: anterior.pasos ?? {} }
      : { huella: actual, commit: commitBase(repo), fecha: ahora(), pasos: {} };
  const limpio = resumen.trim().slice(0, 500);
  estado.pasos[paso] = { ok, fecha: ahora(), resumen: limpio };
  estado.fecha = ahora();
  escribirEstado(estado, opciones.base);
  anotar(
    {
      fecha: estado.fecha,
      evento: "validacion",
      paso,
      ok,
      huella: actual,
      commit: estado.commit,
      resumen: limpio,
    },
    opciones.base,
  );
  return estado;
}

/** Decide si el arbol actual puede commitearse y explica por que no. */
export function evaluar(repo = REPO, base?: string): Evaluacion {
  const actual = huellaArbol(repo);
  const estado = leerEstado(base);
  const resultado: Evaluacion = { permitido: false, motivo: "", huella: actual, pasos: {} };
  if (!estado.huella) {
    resultado.motivo = "No hay ninguna validacion registrada para este repositorio.";
    return resultado;
  }
  if (estado.huella !== actual) {
    resultado.motivo = "El arbol cambio despues de la ultima validacion: la huella no coincide.";
    return resultado;
  }
  const pasos = estado.pasos ?? {};
  resultado.pasos = pasos;
  const cierre = pasos.ci;
  if (cierre && !cierre.ok) {
    resultado.motivo = `El ultimo cierre de \`bun run verify\` fallo: ${cierre.resumen || "algun paso obligatorio fallo"}.`;
    return resultado;
  }
  if (cierre && cierre.ok) {
    resultado.permitido = true;
    resultado.motivo = "Cierre completo en verde para el arbol actual.";
    return resultado;
  }
  const faltan = PASOS_OBLIGATORIOS.filter((paso) => !pasos[paso]?.ok);
  if (faltan.length > 0) {
    resultado.motivo = `Falta la validacion completa: ${faltan.join(", ")}.`;
    return resultado;
  }
  resultado.permitido = true;
  resultado.motivo = "Typecheck, pruebas y L5 en verde para el arbol actual.";
  return resultado;
}

export function mensaje(resultado: Evaluacion): string {
  return [
    `Commit bloqueado: ${resultado.motivo}`,
    "",
    "Corre el cierre completo y vuelve a intentar:",
    "    bun run verify",
    "",
    "El estado queda en .talend-mcp/validacion/estado.json y el historial en",
    ".talend-mcp/validacion/historial.jsonl. No uses `--no-verify`: el gancho existe para que un",
    "cierre en rojo no llegue al historial.",
  ].join("\n");
}

/** Codigo 0 si el commit puede seguir; 1 si el gancho debe rechazarlo. */
export function exigir(opciones: { origen?: string; repo?: string; base?: string } = {}): number {
  const repo = opciones.repo ?? REPO;
  const resultado = evaluar(repo, opciones.base);
  anotar(
    {
      fecha: ahora(),
      evento: "commit",
      permitido: resultado.permitido,
      origen: opciones.origen ?? "gancho-git",
      motivo: resultado.motivo,
      huella: resultado.huella,
      commit: commitBase(repo),
    },
    opciones.base,
  );
  if (resultado.permitido) return 0;
  console.error(mensaje(resultado));
  return 1;
}
