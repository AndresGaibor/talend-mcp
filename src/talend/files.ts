import { mkdirSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
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

/**
 * Escribe un archivo sin dejarlo a medias.
 *
 * `Bun.write` trunca el destino antes de escribir. Si el proceso muere en
 * medio (o Studio lo lee en ese instante), queda un `.item` corrupto que
 * Studio ya no puede abrir. Escribiendo en un temporal y renombrando, el
 * destino pasa de la version vieja a la nueva de una vez.
 */
export function writeTextFileAtomically(
  rutaArchivo: string,
  contenido: string,
  rutaBasePermitida?: string,
): void {
  if (rutaBasePermitida && !isPathInside(rutaArchivo, rutaBasePermitida)) {
    throw new Error(`Ruta fuera del workspace permitido: ${rutaArchivo}`);
  }
  mkdirSync(dirname(rutaArchivo), { recursive: true });
  const temporal = `${rutaArchivo}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  try {
    writeFileSync(temporal, contenido, "utf8");
    renameSync(temporal, rutaArchivo);
  } catch (error) {
    try {
      unlinkSync(temporal);
    } catch {
      // El temporal puede no haberse creado.
    }
    throw error;
  }
}

export async function listFilesRecursive(
  rutaDirectorio: string,
  filtro: (ruta: string) => boolean,
): Promise<string[]> {
  const resultados: string[] = [];
  const pendientes = [rutaDirectorio];
  const concurrency = 32;

  while (pendientes.length > 0) {
    const directorios = pendientes.splice(0, concurrency);
    const grupos = await Promise.all(directorios.map((directorio) => readdir(directorio, { withFileTypes: true })));

    for (let i = 0; i < grupos.length; i++) {
      const directorio = directorios[i]!;
      for (const entrada of grupos[i]!) {
        const rutaEntrada = join(directorio, entrada.name);
        if (entrada.isDirectory()) {
          pendientes.push(rutaEntrada);
        } else if (entrada.isFile() && filtro(rutaEntrada)) {
          resultados.push(rutaEntrada);
        }
      }
    }
  }

  return resultados.sort();
}
