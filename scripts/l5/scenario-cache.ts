import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

/**
 * Escenarios ya validados, para no volver a ejecutarlos.
 *
 * Un escenario que pasa queda guardado con su huella: el propio escenario y las
 * definiciones de componentes con las que se monta su job. Mientras no cambien,
 * la corrida lo omite. No cuentan la version del plugin ni el codigo del arnés:
 * cambiarlos no invalida lo ya validado (que era justo el desperdicio). Para
 * repetirlo todo, `--todas`.
 *
 * No recoge el estado externo (Postgres, S3, HDFS, SMTP). Si esos servicios
 * cambian, hay que repetir con `--todas`.
 */

export type EntradaCache = { huella: string; fecha: string };
export type CacheL5 = Record<string, EntradaCache>;

export function huellaDe(partes: string[]): string {
  const hash = createHash("sha256");
  for (const parte of partes) hash.update(parte).update("\u0000");
  return hash.digest("hex");
}

/** Huella de un escenario con las definiciones de componentes de la corrida. */
export function huellaDeEscenario(escenario: unknown, huellaDefiniciones: string): string {
  return huellaDe([JSON.stringify(escenario), huellaDefiniciones]);
}

/** Lee la cache. Si no existe o esta rota, empieza vacia: solo significa repetir pruebas. */
export function leerCache(ruta: string): CacheL5 {
  if (!existsSync(ruta)) return {};
  try {
    return JSON.parse(readFileSync(ruta, "utf8")) as CacheL5;
  } catch {
    return {};
  }
}

export function escribirCache(ruta: string, cache: CacheL5): void {
  writeFileSync(ruta, JSON.stringify(cache, null, 2), "utf8");
}

export function estaProbado(cache: CacheL5, nombre: string, huella: string): boolean {
  return cache[nombre]?.huella === huella;
}

/**
 * Tipos de componente que usa un escenario: los de su job y los de los jobs
 * auxiliares. Son los unicos cuyas definiciones afectan a su resultado.
 */
export function tiposDeComponentes(escenario: {
  nodos: Array<{ type: string }>;
  jobs?: Array<{ nodos: Array<{ type: string }> }>;
}): string[] {
  const tipos = new Set<string>();
  for (const nodo of escenario.nodos) tipos.add(nodo.type);
  for (const job of escenario.jobs ?? []) for (const nodo of job.nodos) tipos.add(nodo.type);
  return [...tipos].sort();
}

/**
 * Huella de las definiciones de esos componentes. Cambiar un componente que el
 * escenario no usa no invalida su resultado.
 */
export function huellaDeDefiniciones(tipos: string[], definiciones: ReadonlyMap<string, unknown>): string {
  return huellaDe(tipos.map((tipo) => JSON.stringify(definiciones.get(tipo) ?? null)));
}

/**
 * Marca como probados los escenarios que el informe da por buenos, cuando su
 * fichero no cambio despues del informe. Sirve para no repetir lo que ya paso
 * al empezar a usar la cache. Un fichero editado despues no tiene resultado
 * que le corresponda: se vuelve a probar.
 */
export function sembrarDesdeInforme(
  cache: CacheL5,
  entradas: Array<{ nombre: string; huella: string; mtimeFichero: number }>,
  mtimeInforme: number,
): number {
  let agregados = 0;
  for (const entrada of entradas) {
    if (entrada.mtimeFichero > mtimeInforme) continue;
    if (estaProbado(cache, entrada.nombre, entrada.huella)) continue;
    cache[entrada.nombre] = { huella: entrada.huella, fecha: new Date(mtimeInforme).toISOString() };
    agregados++;
  }
  return agregados;
}
