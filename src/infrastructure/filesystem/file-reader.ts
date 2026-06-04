import { mkdirSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { dirname, isAbsolute, join, normalize, relative, resolve } from "node:path";

export function normalizePath(ruta: string): string {
  return normalize(ruta).replace(/\\/g, "/");
}

export function isPathInside(rutaObjetivo: string, rutaBase: string): boolean {
  const objetivo = resolve(rutaObjetivo);
  const base = resolve(rutaBase);
  const relativo = relative(base, objetivo);
  return relativo === "" || (!relativo.startsWith("..") && !isAbsolute(relativo));
}

export async function readTextFile(rutaArchivo: string, rutaBasePermitida?: string): Promise<string> {
  if (rutaBasePermitida && !isPathInside(rutaArchivo, rutaBasePermitida)) {
    throw new Error(`Ruta fuera del workspace permitido: ${rutaArchivo}`);
  }

  return await Bun.file(rutaArchivo).text();
}

export async function writeTextFile(
  rutaArchivo: string,
  contenido: string,
  rutaBasePermitida?: string,
): Promise<void> {
  if (rutaBasePermitida && !isPathInside(rutaArchivo, rutaBasePermitida)) {
    throw new Error(`Ruta fuera del workspace permitido: ${rutaArchivo}`);
  }

  mkdirSync(dirname(rutaArchivo), { recursive: true });
  await Bun.write(rutaArchivo, contenido);
}

export async function listFilesRecursive(
  rutaDirectorio: string,
  filtro: (ruta: string) => boolean,
): Promise<string[]> {
  const resultados: string[] = [];
  const entradas = await readdir(rutaDirectorio, { withFileTypes: true });

  for (const entrada of entradas) {
    const rutaEntrada = join(rutaDirectorio, entrada.name);
    if (entrada.isDirectory()) {
      resultados.push(...await listFilesRecursive(rutaEntrada, filtro));
      continue;
    }

    if (entrada.isFile() && filtro(rutaEntrada)) {
      resultados.push(rutaEntrada);
    }
  }

  return resultados.sort();
}