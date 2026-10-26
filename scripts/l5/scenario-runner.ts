import { existsSync, readFileSync, rmSync } from "node:fs";

import { consultar, preparar } from "./postgres";
import { conRutas } from "./testdata-paths";
import { compararConsulta, compararContextos, compararFichero, compararSalida } from "./scenario-expectations";
import { compilarEnStudio, esperarCompilado } from "./studio-compile";
import { montarJob } from "./job-mounter";
import { ejecutarJob } from "./studio-execute";
import type { Bridge, Definiciones, Escenario, Resultado } from "./scenario-types";

/**
 * Ejecucion de un escenario: jobs auxiliares, montaje, compilacion, ejecucion
 * y comprobacion de lo esperado.
 */

/**
 * Ejecuta un escenario completo y devuelve el resultado de la comprobacion.
 *
 * Al terminar, pase lo que pase, borra sus jobs: un job que se queda abierto en
 * el IDE ocupa memoria del heap de Studio, y antes los de los escenarios que
 * fallaban (y los auxiliares de todos) no se borraban nunca.
 */
export async function ejecutar(
  bridge: Bridge,
  escenario: Escenario,
  definiciones: Definiciones,
): Promise<Resultado> {
  try {
    return await ejecutarEscenario(bridge, escenario, definiciones);
  } finally {
    await borrarJobs(bridge, jobsDelEscenario(escenario));
  }
}

/** Los jobs que monta un escenario: los auxiliares y, al final, el principal. */
export function jobsDelEscenario(escenario: Escenario): string[] {
  return [...(escenario.jobs ?? []).map((auxiliar) => auxiliar.job), escenario.job];
}

async function ejecutarEscenario(
  bridge: Bridge,
  escenario: Escenario,
  definiciones: Definiciones,
): Promise<Resultado> {
  // Los jobs auxiliares (el hijo de un tRunJob) se montan antes que el
  // principal, y se compilan: un job padre necesita su hijo generado para
  // poder llamarlo.
  for (const auxiliar of escenario.jobs ?? []) {
    const montado = await montarJob(bridge, auxiliar, definiciones);
    if (!montado.ok) {
      return { ejecutaOk: false, salidaCorrecta: false, mensaje: montado.mensaje };
    }
    const compilado = await compilarEnStudio(bridge, auxiliar.job);
    if (!compilado.ok) {
      return {
        ejecutaOk: false,
        salidaCorrecta: false,
        mensaje: `no se pudo compilar el job auxiliar '${auxiliar.job}': ${compilado.mensaje}`,
      };
    }
    // Y se espera a que este compilado: si no, el build del padre no lo
    // encuentra y falla.
    const listo = await esperarCompilado(bridge, auxiliar.job);
    if (!listo.ok) {
      return {
        ejecutaOk: false,
        salidaCorrecta: false,
        mensaje: `el job auxiliar '${auxiliar.job}' no llego a compilarse: ${listo.mensaje}`,
      };
    }
  }

  const montado = await montarJob(bridge, escenario, definiciones);
  if (!montado.ok) {
    return { ejecutaOk: false, salidaCorrecta: false, mensaje: montado.mensaje };
  }

  if (escenario.prepara && escenario.prepara.length > 0) {
    const preparado = await preparar(escenario.prepara);
    if (!preparado.ok) {
      return { ejecutaOk: false, salidaCorrecta: false, mensaje: preparado.mensaje };
    }
  }

  const salida = await ejecutarJob(bridge, escenario);
  if (!salida.ok) {
    return { ejecutaOk: false, salidaCorrecta: false, mensaje: salida.mensaje };
  }

  const fallos = await comprobarEspera(bridge, escenario, salida.lineas);

  return {
    ejecutaOk: true,
    salidaCorrecta: fallos.length === 0,
    mensaje: fallos.join("; ") || undefined,
  };
}

/**
 * Comprueba todo lo declarado en `espera`.
 *
 * Las lineas salen de la ejecucion; el fichero se lee del disco y la consulta
 * se lanza contra el Postgres de pruebas.
 */
async function comprobarEspera(bridge: Bridge, escenario: Escenario, lineas: string[]): Promise<string[]> {
  const espera = escenario.espera ?? {};
  const fallos: string[] = [];

  if (espera.contextos) {
    const listados = await bridge.jobContexts({ job: escenario.job });
    const reales =
      (listados.data?.result as {
        contexts?: Array<{ name: string; parameters?: Array<{ name: string; value: string }> }>;
      })?.contexts ?? [];
    fallos.push(...compararContextos(espera.contextos, reales));
  }

  fallos.push(...compararSalida(espera, lineas));

  if (espera.fichero) {
    const ruta = conRutas(espera.fichero.ruta);
    const contenido = existsSync(ruta)
      ? readFileSync(ruta, "utf8").split("\n").filter((linea) => linea.length > 0)
      : null;
    fallos.push(...compararFichero(espera.fichero, contenido, ruta));
  }

  if (espera.consulta) {
    // Lo que el job escribe en la base de datos: se consulta despues de
    // ejecutar (el tDBOutput no saca filas, asi que no hay nada en la salida).
    const valor = await consultar(espera.consulta.sql);
    fallos.push(...compararConsulta(espera.consulta, valor));
  }

  return fallos;
}

/**
 * Borra los jobs del escenario, salvo que `L5_KEEP_JOBS=1`. Un fallo al borrar
 * no tapa el resultado: el job puede no existir si el montaje fallo antes.
 */
async function borrarJobs(bridge: Bridge, jobs: string[]): Promise<void> {
  if (process.env.L5_KEEP_JOBS === "1") return;
  for (const job of jobs) {
    try {
      await bridge.deleteJob({ name: job });
    } catch {
      // Se ignora: el borrado es de limpieza, no parte de la comprobacion.
    }
  }
}
