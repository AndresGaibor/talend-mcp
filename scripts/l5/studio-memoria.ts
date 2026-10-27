import { LIMITE_MEMORIA_PORCENTAJE } from "../coverage/progreso";
import type { Bridge } from "./scenario-types";

/**
 * Margen de memoria del JVM de Studio entre escenarios.
 *
 * Cada Run de Studio deja memoria que no se libera (ver docs de L5): sin un tope,
 * la corrida llena el heap y el IDE deja de responder. Antes de rendirse se pide
 * una recoleccion, porque parte de lo que se mide es basura todavia sin recoger.
 */

async function porcentaje(bridge: Bridge, gc: boolean): Promise<number | undefined> {
  const respuesta = await bridge.memory(gc ? { gc: true } : {});
  if (!respuesta.ok) return undefined;
  return (respuesta.data as { usedPercent?: number } | undefined)?.usedPercent;
}

/**
 * Dice si Studio tiene margen para otro escenario. Si no se puede medir, no
 * bloquea: se sigue como antes de existir esta comprobacion.
 */
export async function margenDeMemoria(bridge: Bridge): Promise<{ usado: number | undefined; hayMargen: boolean }> {
  let usado = await porcentaje(bridge, false);
  if (usado !== undefined && usado >= LIMITE_MEMORIA_PORCENTAJE) {
    usado = (await porcentaje(bridge, true)) ?? usado;
  }
  return { usado, hayMargen: usado === undefined || usado < LIMITE_MEMORIA_PORCENTAJE };
}
