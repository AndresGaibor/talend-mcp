/**
 * Gancho `PreToolUse` de Claude Code: detecta `git commit` y lo bloquea si el arbol actual no tiene
 * el cierre `bun run verify` en verde. Tambien rechaza `--no-verify`, que saltaria el candado.
 */

import { REPO, ahora, anotar, commitBase, evaluar, mensaje } from "./estado";

function palabras(tramo: string): string[] {
  const resultado: string[] = [];
  const patron = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let coincidencia: RegExpExecArray | null;
  while ((coincidencia = patron.exec(tramo)) !== null) {
    resultado.push(coincidencia[1] ?? coincidencia[2] ?? coincidencia[3] ?? "");
  }
  return resultado;
}

/** Detecta `git commit` como subcomando, no como texto dentro de otro argumento. */
export function esCommit(comando: string): boolean {
  for (const tramo of comando.split(/&&|\|\||[;|\n]/)) {
    const partes = palabras(tramo);
    for (let indice = 0; indice < partes.length; indice += 1) {
      if (partes[indice] !== "git") continue;
      let siguiente = indice + 1;
      while (siguiente < partes.length && partes[siguiente]!.startsWith("-")) {
        const opcion = partes[siguiente]!;
        siguiente += 1;
        if (["-C", "-c", "--git-dir", "--work-tree", "--namespace"].includes(opcion)) {
          siguiente += 1;
        }
      }
      if (partes[siguiente] === "commit") return true;
    }
  }
  return false;
}

/** Gancho de Claude Code: bloquea `git commit` sin cierre verde (codigo 2). */
export function guardia(
  entrada: string,
  opciones: { repo?: string; base?: string } = {},
): { codigo: number; aviso: string } {
  let datos: { tool_name?: string; tool_input?: { command?: string } };
  try {
    datos = JSON.parse(entrada || "{}") as typeof datos;
  } catch {
    return { codigo: 0, aviso: "" };
  }
  if (datos.tool_name !== "Bash") return { codigo: 0, aviso: "" };
  const comando = datos.tool_input?.command ?? "";
  if (!esCommit(comando)) return { codigo: 0, aviso: "" };
  const repo = opciones.repo ?? REPO;
  if (comando.includes("--no-verify")) {
    const motivo = "No uses `git commit --no-verify`: el candado de cierre quedaria saltado.";
    anotar(
      {
        fecha: ahora(),
        evento: "commit",
        permitido: false,
        origen: "claude",
        motivo,
        huella: "",
        commit: commitBase(repo),
      },
      opciones.base,
    );
    return { codigo: 2, aviso: `Commit bloqueado: ${motivo}\n\nCorre \`bun run verify\`.` };
  }
  if (/\bbun run verify(?=\s|$)/.test(comando) || comando.includes("scripts/verificar.ts")) {
    // El cierre corre antes del commit en el mismo comando y deja el estado; el gancho de git
    // comprueba el resultado justo antes de crear el commit.
    return { codigo: 0, aviso: "" };
  }
  const resultado = evaluar(repo, opciones.base);
  anotar(
    {
      fecha: ahora(),
      evento: "commit",
      permitido: resultado.permitido,
      origen: "claude",
      motivo: resultado.motivo,
      huella: resultado.huella,
      commit: commitBase(repo),
    },
    opciones.base,
  );
  if (resultado.permitido) return { codigo: 0, aviso: "" };
  return { codigo: 2, aviso: mensaje(resultado) };
}
