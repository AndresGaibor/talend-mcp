import { resolve } from "node:path";

/**
 * Rutas de los datos de prueba.
 *
 * Los escenarios escriben `@TESTDATA@` y el arnes lo sustituye por la carpeta
 * absoluta: el job corre en el workspace de Studio, no en este repositorio.
 */
export const CARPETA_TESTDATA = resolve(process.cwd(), "testdata");

/** Sustituye `@TESTDATA@` por la ruta absoluta de los datos de prueba. */
export function conRutas(valor: string): string {
  return valor.replace(/@TESTDATA@/g, CARPETA_TESTDATA.replace(/\\/g, "/"));
}
