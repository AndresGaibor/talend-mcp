import { existsSync, rmSync } from "node:fs";

import { conRutas } from "./testdata-paths";
import { errorDe } from "./studio-retry";
import type { Bridge, Escenario } from "./scenario-types";
import { medir } from "./tiempos";

/**
 * Ejecucion del job ya construido y lectura de su salida.
 *
 * El job se construye antes con `construirEnStudio` (genera, compila y hace el build
 * de Maven). Aqui solo se ejecuta una vez: `executeJob` lanza el `classpath.jar` y
 * devuelve lo que imprime, su codigo de salida y su error.
 */

export type SalidaJob = { ok: true; lineas: string[]; stderr?: string[] } | { ok: false; mensaje: string };

/** Tiempo maximo de la ejecucion del job, si el escenario no pide otro. */
const TIMEOUT_JOB_MS = 180_000;

/**
 * La linea que explica por que termino el job con error.
 *
 * Un job que falla llena la salida de avisos (`[WARN]`) antes del error real,
 * asi que tomar las primeras lineas enseña el ruido. Se elige, por orden: la
 * ultima causa (`Caused by`), la primera linea `[FATAL]`, la primera `[ERROR]`
 * y, si no hay ninguna, la ultima linea.
 */
export function causaDeFallo(lineas: string[]): string {
  const ultimaCausa = lineas.filter((linea) => linea.includes("Caused by")).pop();
  const elegida =
    ultimaCausa ??
    lineas.find((linea) => linea.includes("[FATAL]")) ??
    lineas.find((linea) => linea.includes("[ERROR]")) ??
    // Un fallo que sale por stderr (una excepcion sin el prefijo de log) no lleva [FATAL].
    lineas.find((linea) => /Exception|Error/.test(linea)) ??
    lineas[lineas.length - 1] ??
    "sin salida";
  return elegida.trim().slice(0, 300);
}

/** Las lineas de un texto, sin las vacias. */
function lineasDe(texto: string): string[] {
  return texto.split(/\r?\n/).filter((linea) => linea.length > 0);
}

/**
 * Borra el fichero de salida antes de ejecutar. El tFileOutputDelimited se niega
 * a sobrescribir un fichero que ya existe.
 */
function borrarFicheroDeSalida(escenario: Escenario): void {
  if (!escenario.espera?.fichero) return;
  const ruta = conRutas(escenario.espera.fichero.ruta);
  if (existsSync(ruta)) rmSync(ruta, { force: true });
}

/** Decide el resultado del job a partir de su codigo de salida, sus lineas y su error. */
function interpretarSalida(
  escenario: Escenario,
  salida: { exitCode?: number | null; lineas: string[]; stderr?: string[]; error?: string },
): SalidaJob {
  if (salida.error) {
    return { ok: false, mensaje: `error al ejecutar: ${salida.error}` };
  }
  if (salida.exitCode !== undefined && salida.exitCode !== null && salida.exitCode !== 0) {
    // Un job puede terminar en error a proposito: lo que importa es que el
    // trigger de error se ejecuto (su salida se comprueba despues).
    if (!escenario.espera?.error_esperado) {
      // La causa puede estar solo en stderr: se busca primero en stdout y luego en stderr.
      // Las lineas de stderr no entran en la comprobacion de la salida.
      return {
        ok: false,
        mensaje: `salida con codigo ${salida.exitCode}. Causa: ${causaDeFallo([...salida.lineas, ...(salida.stderr ?? [])])}`,
      };
    }
  }
  return { ok: true, lineas: salida.lineas, stderr: salida.stderr };
}

/**
 * Donde corre el job. Por defecto (`enStudio: false`) se ejecuta con `executeJob`: rapido, y el
 * job no aparece en Studio. Con `enStudio: true` se lanza con el Run de Studio, que si se ve
 * en su consola; es mas lento y, si el escenario comprueba lineas de salida, el job corre otra
 * vez con `executeJob` para leerlas (la salida no la da el Run).
 */
export type ModoEjecucion = { enStudio: boolean };

export const EJECUCION_RAPIDA: ModoEjecucion = { enStudio: false };

/** Si el escenario comprueba lineas de la salida del job (y no solo un fichero o una consulta). */
function esperaLineas(escenario: Escenario): boolean {
  const espera = escenario.espera;
  return espera?.lineas !== undefined || (espera?.contiene?.length ?? 0) > 0;
}

/**
 * Ejecuta el job ya construido y devuelve su salida.
 *
 * Por defecto, una sola ejecucion: el job no se lanza una segunda vez para leer su salida,
 * asi que los efectos (un INSERT, un fichero) ocurren una vez.
 */
export async function ejecutarJob(
  bridge: Bridge,
  escenario: Escenario,
  modo: ModoEjecucion = EJECUCION_RAPIDA,
): Promise<SalidaJob> {
  const tiempoMs = escenario.timeoutMs ?? TIMEOUT_JOB_MS;
  borrarFicheroDeSalida(escenario);

  if (modo.enStudio) {
    const run = await medir("run en studio", () =>
      bridge.runActiveJob(
        { dryRun: false, saveBefore: true, waitForTermination: true, timeoutMs: tiempoMs },
        { timeoutMs: tiempoMs + 30_000 },
      ),
    );
    if (!run.ok) return { ok: false, mensaje: `no se pudo ejecutar en Studio: ${errorDe(run)}` };
    const datos = (run.data ?? {}) as {
      error?: { message?: string };
      launched?: boolean;
      timeout?: boolean;
    };
    if (datos.error) {
      return { ok: false, mensaje: `el Run de Studio fallo: ${datos.error.message ?? JSON.stringify(datos.error)}` };
    }
    if (!datos.launched) return { ok: false, mensaje: "Studio no lanzo el job" };
    if (datos.timeout) return { ok: false, mensaje: "el job no termino a tiempo" };
    // El Run no devuelve la salida ni el codigo de salida: sin lineas que comprobar, el
    // resultado se juzga por sus efectos (base de datos, fichero) que comprueba el escenario.
    if (!esperaLineas(escenario)) return { ok: true, lineas: [] };
    borrarFicheroDeSalida(escenario);
  }

  const ejecutado = await medir("executeJob", () =>
    bridge.executeJob({
      name: escenario.job,
      context: escenario.contexto,
      timeoutMs: tiempoMs,
    }),
  );
  if (!ejecutado.ok) {
    return { ok: false, mensaje: `no se pudo ejecutar: ${errorDe(ejecutado)}` };
  }

  const datos = (ejecutado.data ?? {}) as {
    result?: { exitCode?: number | null; lines?: string[]; stdout?: string; stderr?: string; error?: string };
    exitCode?: number;
    lines?: string[];
    stdout?: string;
    stderr?: string;
    error?: string;
  };
  const cuerpo = (datos.result ?? datos) as {
    exitCode?: number | null;
    lines?: string[];
    stdout?: string;
    stderr?: string;
    error?: string;
  };
  const lineas = cuerpo.lines ?? lineasDe(cuerpo.stdout ?? "");

  // El error de un job suele estar en stderr (una excepcion de tMap, por ejemplo): sin
  // esto el fallo se veia como "sin salida".
  return interpretarSalida(escenario, {
    exitCode: cuerpo.exitCode,
    lineas,
    stderr: lineasDe(cuerpo.stderr ?? ""),
    error: cuerpo.error,
  });
}
