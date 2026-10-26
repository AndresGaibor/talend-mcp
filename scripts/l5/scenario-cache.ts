import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Escenarios ya probados, para no volver a ejecutarlos.
 *
 * Un escenario que pasa queda guardado con su huella: el propio escenario, el
 * codigo del arnes y el contexto de la corrida (version del plugin de Studio y
 * definiciones de componentes). Mientras la huella no cambie, la corrida lo omite.
 * Si cambia cualquiera de esas tres cosas, se vuelve a probar.
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

/** Huella del codigo del arnes: cualquier cambio en `scripts/l5` la invalida. */
export function huellaDelArnes(): string {
  const carpeta = import.meta.dir;
  const ficheros = readdirSync(carpeta).filter((fichero) => fichero.endsWith(".ts")).sort();
  return huellaDe(ficheros.flatMap((fichero) => [fichero, readFileSync(join(carpeta, fichero), "utf8")]));
}

/** Huella de un escenario dentro de una corrida concreta. */
export function huellaDeEscenario(escenario: unknown, huellaArnes: string, huellaContexto: string): string {
  return huellaDe([JSON.stringify(escenario), huellaArnes, huellaContexto]);
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
