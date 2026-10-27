import type { Bridge, Paso } from "./scenario-types";
import { errorDe, reintentar, transitorioDeStudio } from "./studio-retry";

/**
 * Construccion del job para el arnes: generar el codigo, compilarlo y hacer el build
 * de Maven que deja el `target/classpath.jar` que luego lee `executeJob`.
 *
 * Es sincrona: cuando vuelve, el build ya ha terminado, asi que no hay que esperar a
 * nada. Antes se hacia con un Run de Studio, que lanzaba el job y no informaba de su
 * fin (ver la seccion 79 de docs/studio-internals/08-interfaz-ui.md).
 */

type DetalleDeError = { message?: string; line?: number };

/**
 * Construye el job sin ejecutarlo: genera el codigo, lo compila y hace el build de
 * Maven. Un error de compilacion sale con su linea y su mensaje.
 */
export async function construirEnStudio(bridge: Bridge, job: string, instalar = false): Promise<Paso> {
  const abierto = await reintentar(() => bridge.openJob({ name: job }), transitorioDeStudio);
  if (!abierto.ok) {
    return { ok: false, mensaje: `no se pudo abrir el job: ${errorDe(abierto)}` };
  }

  const respuesta = await bridge.jobBuild({ job, instalar });
  if (!respuesta.ok) {
    return { ok: false, mensaje: `no se pudo construir el job: ${errorDe(respuesta)}` };
  }
  const cuerpo = (respuesta.data?.result ?? {}) as {
    compiles?: boolean;
    built?: boolean;
    error?: DetalleDeError | string;
    metodo?: string;
    generationMs?: number;
    generateMs?: number;
    classpathMs?: number;
    compileMs?: number;
    jarMs?: number;
  };
  if (process.env.L5_TIEMPOS === "1") {
    console.error(
      `[tiempo] construir detalle: generar ${cuerpo.generateMs} ms, comprobar ${(cuerpo.generationMs ?? 0) - (cuerpo.generateMs ?? 0)} ms, classpath ${cuerpo.classpathMs} ms, ${cuerpo.metodo} ${cuerpo.compileMs} ms, jar ${cuerpo.jarMs} ms`,
    );
  }
  if (!cuerpo.compiles) {
    return { ok: false, mensaje: `no compila: ${textoDeError(cuerpo.error)}` };
  }
  if (!cuerpo.built) {
    return { ok: false, mensaje: `no se pudo compilar el job: ${textoDeError(cuerpo.error)}` };
  }
  return { ok: true };
}

function textoDeError(error: DetalleDeError | string | undefined): string {
  if (!error) return "sin detalle";
  if (typeof error === "string") return error;
  const linea = error.line !== undefined ? ` (linea ${error.line})` : "";
  return `${error.message ?? "sin detalle"}${linea}`;
}
