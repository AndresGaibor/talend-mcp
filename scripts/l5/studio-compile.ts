import type { Bridge, Paso } from "./scenario-types";
import { compilando, errorDe, esperar, reintentar, transitorioDeStudio } from "./studio-retry";

/**
 * Generacion y compilacion del job con el Run de Studio.
 *
 * El Run es asincrono: lanza el build y sigue. La ejecucion solo funciona
 * cuando el build ha terminado, asi que se espera probando la ejecucion.
 */

export type EsperaCompiladoOptions = {
  intentos?: number;
  esperaInicialMs?: number;
  esperaMs?: number;
};

/**
 * Lanza el Run de Studio: genera, compila y deja el `target/classpath.jar`
 * que la ejecucion necesita para releer la salida.
 */
export async function compilarEnStudio(bridge: Bridge, job: string): Promise<Paso> {
  const abierto = await reintentar(
    () => bridge.openJob({ name: job }),
    transitorioDeStudio,
  );
  if (!abierto.ok) {
    return { ok: false, mensaje: `no se pudo abrir el job: ${errorDe(abierto)}` };
  }

  const lanzado = await bridge.runActiveJob({
    dryRun: false,
    saveBefore: true,
    waitForTermination: false,
    timeoutMs: 30_000,
  });
  if (!lanzado.ok) {
    return { ok: false, mensaje: `no se pudo ejecutar en Studio: ${errorDe(lanzado)}` };
  }

  const datos = (lanzado.data ?? {}) as { error?: { message?: string }; launched?: boolean };
  if (datos.error) {
    return {
      ok: false,
      mensaje: `el Run de Studio fallo: ${datos.error.message ?? JSON.stringify(datos.error)}`,
    };
  }
  if (!datos.launched) {
    return { ok: false, mensaje: "Studio no lanzo el job" };
  }
  return { ok: true };
}

/**
 * Espera a que un job este compilado.
 *
 * Se espera un poco antes del primer intento: ejecutar el job abre su
 * `classpath.jar`, y si Studio esta justo reemplazandolo el build falla con
 * "El proceso no tiene acceso al archivo" y la carpeta se queda sin codigo
 * (INTERNALS 55). Unos segundos de margen evitan casi siempre el choque.
 */
export async function esperarCompilado(
  bridge: Bridge,
  job: string,
  options: EsperaCompiladoOptions = {},
): Promise<Paso> {
  const intentos = options.intentos ?? 30;
  const esperaInicialMs = options.esperaInicialMs ?? 12_000;
  const esperaMs = options.esperaMs ?? 5_000;

  await esperar(esperaInicialMs);
  for (let intento = 0; intento < intentos; intento++) {
    const ejecutado = await bridge.executeJob({ name: job, timeoutMs: 120_000 });
    const cuerpo = (ejecutado.data ?? {}) as {
      result?: { error?: string };
      error?: string;
    };
    const error = cuerpo.result?.error ?? cuerpo.error ?? "";
    if (!compilando(error)) {
      return { ok: true };
    }
    await esperar(esperaMs);
  }
  return { ok: false, mensaje: "el build no termino a tiempo" };
}
