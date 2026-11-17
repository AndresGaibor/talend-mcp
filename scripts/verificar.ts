/**
 * Cierre unico del repositorio: `bun run verify`.
 *
 * Corre los tres pasos obligatorios en orden, anota cada uno y deja un unico estado para el arbol
 * actual en `.talend-mcp/validacion/estado.json`. El gancho `pre-commit` y el gancho de Claude Code
 * (`PreToolUse`) leen ese estado: si falta un paso, si alguno quedo en rojo o si el arbol cambio
 * despues de validar, el commit se rechaza.
 *
 *   bun run verify              cierre completo (typecheck + pruebas + L5)
 *   bun run verify:directo      lo mismo sin dejar estado (para depurar)
 *
 * Los pasos se corren todos aunque uno falle, para que el estado diga exactamente que quedo mal.
 */

import { spawnSync } from "node:child_process";

import {
  PASOS_OBLIGATORIOS,
  REPO,
  huellaArbol,
  registrar,
  type Estado,
} from "./validacion";

export interface PasoEjecutado {
  nombre: string;
  ok: boolean;
  resumen: string;
  salida: string;
}

export interface ResultadoCierre {
  ok: boolean;
  huella: string;
  pasos: PasoEjecutado[];
  estado: Estado;
}

const COMANDOS: Record<string, string[]> = {
  typecheck: ["run", "typecheck"],
  tests: ["test"],
  l5: ["run", "l5:validar"],
};

function resumirTypecheck(salida: string, ok: boolean): string {
  if (ok) return "sin errores";
  const lineas = salida
    .split(/\r?\n/)
    .map((linea) => linea.trim())
    .filter(Boolean);
  return lineas.slice(-3).join(" | ") || "tsc fallo sin salida";
}

function resumirTests(salida: string, ok: boolean): string {
  const pasadas = /(\d+)\s+pass/.exec(salida)?.[1];
  const fallidas = /(\d+)\s+fail/.exec(salida)?.[1];
  if (pasadas !== undefined || fallidas !== undefined) {
    const partes: string[] = [];
    if (pasadas !== undefined) partes.push(`${pasadas} pasadas`);
    if (fallidas !== undefined) partes.push(`${fallidas} fallidas`);
    return partes.join(", ");
  }
  return ok ? "suite en verde" : "la suite fallo sin resumen";
}

function resumirL5(salida: string, ok: boolean): string {
  const lineas = salida
    .split(/\r?\n/)
    .map((linea) => linea.trim())
    .filter(Boolean);
  const escenarios = lineas.find((linea) => linea.startsWith("Escenarios validos"));
  if (escenarios) return escenarios;
  const cierre = [...lineas].reverse().find((linea) => /\bOK\b/.test(linea));
  return cierre ?? (ok ? "escenarios L5 validos" : "L5 fallo sin salida");
}

const RESUMENES: Record<string, (salida: string, ok: boolean) => string> = {
  typecheck: resumirTypecheck,
  tests: resumirTests,
  l5: resumirL5,
};

function ejecutarPaso(nombre: string): PasoEjecutado {
  const args = COMANDOS[nombre];
  if (!args) throw new Error(`Paso desconocido: ${nombre}`);
  const proceso = spawnSync(process.execPath, args, {
    cwd: REPO,
    encoding: "utf8",
    env: process.env,
  });
  const salida = `${proceso.stdout ?? ""}${proceso.stderr ?? ""}`;
  const ok = proceso.status === 0;
  return {
    nombre,
    ok,
    resumen: (RESUMENES[nombre] ?? (() => ""))(salida, ok),
    salida,
  };
}

/** Corre el cierre completo y deja el estado del arbol. */
export function ejecutarCierre(
  opciones: { pasos?: readonly string[]; silencioso?: boolean; base?: string } = {},
): ResultadoCierre {
  const pasos = opciones.pasos ?? PASOS_OBLIGATORIOS;
  const silencioso = opciones.silencioso ?? false;
  const ejecutados: PasoEjecutado[] = [];
  for (const nombre of pasos) {
    if (!silencioso) console.log(`[${nombre}] corriendo...`);
    const paso = ejecutarPaso(nombre);
    ejecutados.push(paso);
    if (!silencioso) {
      if (paso.salida.trim()) console.log(paso.salida.trimEnd());
      console.log(`[${nombre}] ${paso.ok ? "OK" : "FALLA"} en ${paso.resumen}`);
    }
  }

  // Una sola huella para todos los pasos: el estado representa el mismo arbol.
  const huella = huellaArbol(REPO);
  for (const paso of ejecutados) {
    registrar(paso.nombre, paso.ok, paso.resumen, { repo: REPO, base: opciones.base, huella });
  }
  const fallos = ejecutados.filter((paso) => !paso.ok);
  const resumen = fallos.length === 0 ? "Todo verde" : `Falla: ${fallos.map((p) => p.nombre).join(", ")}`;
  const estado = registrar("ci", fallos.length === 0, resumen, {
    repo: REPO,
    base: opciones.base,
    huella,
  });

  if (!silencioso) {
    console.log("");
    console.log("| Paso | Estado | Resumen |");
    console.log("|---|---|---|");
    for (const paso of ejecutados) {
      console.log(`| ${paso.nombre} | ${paso.ok ? "OK" : "FALLA"} | ${paso.resumen} |`);
    }
    console.log(`| ci | ${fallos.length === 0 ? "OK" : "FALLA"} | ${resumen} |`);
    console.log("");
    console.log(
      fallos.length === 0
        ? "Commit permitido: si. El estado quedo en .talend-mcp/validacion/estado.json."
        : "Commit bloqueado: corrige los pasos en rojo y vuelve a correr `bun run verify`.",
    );
  }

  return { ok: fallos.length === 0, huella, pasos: ejecutados, estado };
}

if (import.meta.main) {
  const resultado = ejecutarCierre();
  process.exit(resultado.ok ? 0 : 1);
}
