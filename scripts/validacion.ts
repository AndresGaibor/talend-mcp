/**
 * Candado de cierre: exige `bun run verify` en verde para el arbol que se va a commitear.
 *
 *   bun run scripts/validacion.ts estado      que se valido y si el commit pasaria
 *   bun run scripts/validacion.ts historial   ultimas validaciones e intentos de commit
 *   bun run scripts/validacion.ts exigir      lo llama el gancho pre-commit
 *   bun run scripts/validacion.ts guardia     lo llama el gancho PreToolUse de Claude Code
 *
 * La logica vive en `scripts/validacion/`: `estado.ts` calcula la huella y decide, y `guardia.ts`
 * interpreta el comando de Claude. Este archivo es la fachada para los scripts y el CLI.
 */

import { readFileSync } from "node:fs";

import {
  REPO,
  anotar,
  ahora,
  commitBase,
  directorio,
  escribirEstado,
  evaluar,
  exigir,
  huellaArbol,
  leerEstado,
  mensaje,
  registrar,
  rutaHistorial,
  PASOS_OBLIGATORIOS,
  type Estado,
  type Evaluacion,
  type PasoEstado,
} from "./validacion/estado";
import { esCommit, guardia } from "./validacion/guardia";

export {
  PASOS_OBLIGATORIOS,
  REPO,
  anotar,
  ahora,
  commitBase,
  directorio,
  esCommit,
  escribirEstado,
  evaluar,
  exigir,
  guardia,
  huellaArbol,
  leerEstado,
  mensaje,
  registrar,
  rutaHistorial,
};
export type { Estado, Evaluacion, PasoEstado };

function cmdEstado(repo = REPO, base?: string): number {
  const estado = leerEstado(base);
  const actual = huellaArbol(repo);
  console.log(`Arbol actual: ${actual.slice(0, 12)}`);
  if (!estado.huella) {
    console.log("Sin validaciones registradas.");
    console.log("Commit permitido: no (corre `bun run verify`).");
    return 1;
  }
  console.log(`Validado: ${estado.fecha ?? "?"} sobre ${estado.huella.slice(0, 12)}`);
  console.log(`Commit base: ${estado.commit?.slice(0, 12) || "(sin commits)"}`);
  const pasos = estado.pasos ?? {};
  if (Object.keys(pasos).length === 0) console.log("  (ningun paso anotado)");
  for (const nombre of Object.keys(pasos).sort()) {
    const datos = pasos[nombre]!;
    console.log(
      `  ${nombre.padEnd(9)} ${(datos.ok ? "OK" : "FALLA").padEnd(5)} ${datos.resumen}`.trimEnd(),
    );
  }
  const resultado = evaluar(repo, base);
  console.log(
    `Commit permitido: ${resultado.permitido ? "si" : "no"} (${resultado.motivo})`,
  );
  return resultado.permitido ? 0 : 1;
}

function cmdHistorial(cantidad: number, base?: string): number {
  let lineas: string[];
  try {
    lineas = readFileSync(rutaHistorial(base), "utf8").split("\n");
  } catch {
    console.log(`No hay historial en ${directorio(base)}.`);
    return 1;
  }
  for (const linea of lineas.filter(Boolean).slice(-cantidad)) {
    let evento: Record<string, unknown>;
    try {
      evento = JSON.parse(linea) as Record<string, unknown>;
    } catch {
      continue;
    }
    if (evento.evento === "validacion") {
      const marca = evento.ok ? "OK" : "FALLA";
      console.log(
        `${evento.fecha}  ${String(evento.paso ?? "?").padEnd(9)} ${marca.padEnd(5)} ${evento.resumen ?? ""}`.trimEnd(),
      );
    } else {
      const marca = evento.permitido ? "PERMITE" : "BLOQUEA";
      console.log(
        `${evento.fecha}  commit    ${marca.padEnd(8)} ${evento.motivo ?? ""}`.trimEnd(),
      );
    }
  }
  return 0;
}

function main(argv: string[]): number {
  const [comando, ...resto] = argv;
  if (comando === "estado") return cmdEstado();
  if (comando === "historial") {
    const cantidad = Number(resto[0] ?? 20);
    return cmdHistorial(Number.isFinite(cantidad) ? cantidad : 20);
  }
  if (comando === "exigir") {
    const indice = resto.indexOf("--origen");
    const origen = indice >= 0 ? (resto[indice + 1] ?? "gancho-git") : "gancho-git";
    return exigir({ origen });
  }
  if (comando === "guardia") {
    const { codigo, aviso } = guardia(readFileSync(0, "utf8"));
    if (aviso) console.error(aviso);
    return codigo;
  }
  console.error("Uso: bun run scripts/validacion.ts <estado|historial|exigir|guardia>");
  return 2;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
