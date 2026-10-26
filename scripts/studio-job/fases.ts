import type { Bridge } from "./shared";

/**
 * Comandos del CLI y fases cargables.
 *
 * El mapa vive aparte del punto de entrada para poder probarlo sin ejecutar el
 * CLI: cada loader se resuelve bajo demanda y no importa Studio.
 */

export type CargadorFase = () => Promise<{ default: (bridge: Bridge) => Promise<void> }>;

/** Comandos que no son fases y hablan directo con el bridge. */
export const COMANDOS = new Set([
  "create",
  "delete",
  "open",
  "add",
  "connect",
  "schema",
  "list",
  "run",
  "execute",
  "dialogs",
]);

/** Una fase por archivo en `scripts/studio-job/`. */
export const FASES: Record<string, CargadorFase> = {
  fase0: () => import("./fase0"),
  fase1: () => import("./fase1"),
  fase1b: () => import("./fase1b"),
  fase2: () => import("./fase2"),
  fase3: () => import("./fase3"),
  fase4: () => import("./fase4"),
  fase5: () => import("./fase5"),
  fase6: () => import("./fase6"),
  fase9: () => import("./fase9"),
};

/** Comandos validos, con las fases al final y en el orden del mapa. */
export function comandosDisponibles(): string[] {
  return [...COMANDOS, ...Object.keys(FASES)];
}

/** Un comando es valido si es simple o si tiene una fase registrada. */
export function comandoConocido(comando: string): boolean {
  return COMANDOS.has(comando) || Object.hasOwn(FASES, comando);
}
