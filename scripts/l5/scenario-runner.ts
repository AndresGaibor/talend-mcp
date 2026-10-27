import { existsSync, readFileSync, rmSync } from "node:fs";

import {
  clasificarProblemas,
  clasificarSalida,
  juntar,
  problemasDe,
  resumir,
  sinTolerados,
  type Hallazgos,
} from "./avisos";
import { consultar, preparar } from "./postgres";
import { conRutas } from "./testdata-paths";
import { compararConsulta, compararContextos, compararFichero, compararSalida } from "./scenario-expectations";
import { construirEnStudio } from "./studio-compile";
import { montarJob } from "./job-mounter";
import { EJECUCION_RAPIDA, ejecutarJob, type ModoEjecucion } from "./studio-execute";
import type { Bridge, Definiciones, Escenario, Resultado } from "./scenario-types";
import { medir } from "./tiempos";

/**
 * Ejecucion de un escenario: jobs auxiliares, montaje, construccion, ejecucion
 * y comprobacion de lo esperado.
 *
 * Se divide en dos fases para poder solapar escenarios: `prepararEscenario` monta y
 * construye (usa la UI de Studio), y `terminar` ejecuta y comprueba (usa la JVM del
 * job). El harness prepara el siguiente escenario mientras el anterior se ejecuta.
 */

/** Un escenario montado y construido, a la espera de ejecutarse. */
export type EscenarioPreparado = {
  /** Los jobs que ocupa: no se pueden montar otra vez mientras `terminar` no acabe. */
  jobs: string[];
  /** Ejecuta el job, comprueba lo esperado y borra los jobs del escenario. */
  terminar: () => Promise<Resultado>;
};

/** Resultado de montar y construir: o el fallo que lo para, o lo que hace falta para ejecutar. */
type Montaje = { fallo: Resultado } | { listo: { diseno: Hallazgos; tolerados?: string[] } };

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
  const preparado = await prepararEscenario(bridge, escenario, definiciones);
  return preparado.terminar();
}

/**
 * Monta y construye un escenario sin ejecutarlo. Su ejecucion queda en `terminar`:
 * asi el harness puede montar el siguiente escenario mientras este corre.
 */
export async function prepararEscenario(
  bridge: Bridge,
  escenario: Escenario,
  definiciones: Definiciones,
  modo: ModoEjecucion = EJECUCION_RAPIDA,
): Promise<EscenarioPreparado> {
  const jobs = jobsDelEscenario(escenario);
  let montaje: Montaje;
  try {
    montaje = await montarYConstruir(bridge, escenario, definiciones);
  } catch (error) {
    await medir("borrado de jobs", () => borrarJobs(bridge, [escenario.job]));
    throw error;
  }
  return {
    jobs,
    terminar: async () => {
      try {
        if ("fallo" in montaje) return montaje.fallo;
        return await ejecutarYComprobar(bridge, escenario, montaje.listo, modo);
      } finally {
        await medir("borrado de jobs", () => borrarJobs(bridge, [escenario.job]));
      }
    },
  };
}

/**
 * Los jobs que monta un escenario: los auxiliares y, al final, el principal.
 *
 * Los auxiliares (el hijo de un tRunJob) no se borran al terminar: el pom del padre los
 * referencia, y borrarlos deja a Eclipse con un proyecto sin carpeta, que rompe el build
 * de todos los jobs siguientes en la misma sesion de Studio. Se reemplazan al montarlos.
 */
export function jobsDelEscenario(escenario: Escenario): string[] {
  return [...(escenario.jobs ?? []).map((auxiliar) => auxiliar.job), escenario.job];
}

async function montarYConstruir(
  bridge: Bridge,
  escenario: Escenario,
  definiciones: Definiciones,
): Promise<Montaje> {
  // Los jobs auxiliares (el hijo de un tRunJob) se montan y se construyen antes que el
  // principal: el build del padre necesita el hijo ya generado.
  for (const auxiliar of escenario.jobs ?? []) {
    const montado = await montarJob(bridge, auxiliar, definiciones);
    if (!montado.ok) {
      return { fallo: { ejecutaOk: false, salidaCorrecta: false, mensaje: montado.mensaje } };
    }
    const construido = await construirEnStudio(bridge, auxiliar.job, true);
    if (!construido.ok) {
      return {
        fallo: {
          ejecutaOk: false,
          salidaCorrecta: false,
          mensaje: `no se pudo construir el job auxiliar '${auxiliar.job}': ${construido.mensaje}`,
        },
      };
    }
  }

  const montado = await medir("montaje", () => montarJob(bridge, escenario, definiciones));
  if (!montado.ok) {
    return { fallo: { ejecutaOk: false, salidaCorrecta: false, mensaje: montado.mensaje } };
  }

  // Se construye antes de leer los problemas de diseno: la vista Problemas se actualiza
  // al generar el codigo. Leida justo despues del montaje daba errores que ya no existian.
  const construido = await medir("construir", () => construirEnStudio(bridge, escenario.job));
  if (!construido.ok) {
    return { fallo: { ejecutaOk: false, salidaCorrecta: false, mensaje: construido.mensaje } };
  }

  const tolerados = escenario.espera?.avisos_tolerados;
  const diseno = sinTolerados(
    await medir("problemas de diseno", () => leerProblemasDeDiseno(bridge, escenario.job)),
    tolerados,
  );
  if (!escenario.espera?.error_esperado && diseno.errores.length > 0) {
    return {
      fallo: {
        ejecutaOk: false,
        salidaCorrecta: false,
        mensaje: resumir("errores de diseno tras construir", diseno.errores),
      },
    };
  }

  if (escenario.prepara && escenario.prepara.length > 0) {
    const preparado = await preparar(escenario.prepara);
    if (!preparado.ok) {
      return { fallo: { ejecutaOk: false, salidaCorrecta: false, mensaje: preparado.mensaje } };
    }
  }

  return { listo: { diseno, tolerados } };
}

async function ejecutarYComprobar(
  bridge: Bridge,
  escenario: Escenario,
  { diseno, tolerados }: { diseno: Hallazgos; tolerados?: string[] },
  modo: ModoEjecucion,
): Promise<Resultado> {
  const salida = await medir("ejecucion", () => ejecutarJob(bridge, escenario, modo));
  if (!salida.ok) {
    return { ejecutaOk: false, salidaCorrecta: false, mensaje: salida.mensaje };
  }

  const fallos = await comprobarEspera(bridge, escenario, salida.lineas);

  // Un job puede salir con codigo 0 y dejar [ERROR] en su salida o errores de diseno:
  // eso es un fallo, salvo que el escenario lo espere. Los avisos solo se anotan.
  const enSalida = sinTolerados(clasificarSalida([...salida.lineas, ...(salida.stderr ?? [])]), tolerados);
  const hallazgos = juntar(diseno, enSalida);
  if (!escenario.espera?.error_esperado && hallazgos.errores.length > 0) {
    fallos.push(resumir("errores con el job terminado", hallazgos.errores));
  }
  const avisos = resumir("avisos", hallazgos.avisos);

  return {
    ejecutaOk: true,
    salidaCorrecta: fallos.length === 0,
    mensaje: [...fallos, avisos].filter(Boolean).join("; ") || undefined,
    avisos: hallazgos.avisos,
  };
}

/** Errores y avisos de la vista Problemas. Si Studio no los da, no se inventan. */
async function leerProblemasDeDiseno(bridge: Bridge, job: string): Promise<Hallazgos> {
  try {
    const respuesta = await bridge.jobProblems({ job });
    return clasificarProblemas(problemasDe(respuesta.data));
  } catch {
    return { errores: [], avisos: [] };
  }
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
