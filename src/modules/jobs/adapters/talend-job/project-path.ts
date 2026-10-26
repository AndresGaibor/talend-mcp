import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { getConfiguredProjectPath } from "../../../../talend/workspace";

/**
 * La ruta del proyecto de Talend.
 *
 * Se usa la que haya configurada (la del proyecto abierto en Studio) y, si se
 * pasa una ruta, la que tenga una carpeta `process`.
 */
export function resolveProjectPath(candidate?: string): string {
  if (candidate) {
    const absoluta = resolve(candidate);
    if (isProjectPath(absoluta)) return absoluta;
  }
  const configured = getConfiguredProjectPath();
  if (!configured) {
    throw new Error(
      "No se ha podido determinar el proyecto de Talend: abre un proyecto en Studio o define TALEND_PROJECT",
    );
  }
  return configured;
}

/** Si una ruta es la de un proyecto de Talend (tiene la carpeta `process`). */
export function isProjectPath(candidate: string): boolean {
  try {
    return existsSync(join(resolve(candidate), "process"));
  } catch {
    return false;
  }
}

/** La carpeta dentro de `process` donde va un job. */
export function folderOf(path: string): string {
  const normalized = normalize(path);
  const marker = "/process/";
  const cut = normalized.indexOf(marker);
  if (cut >= 0) return normalized.slice(cut + marker.length);
  return normalized.replace(/^\/+/, "");
}

/** Normaliza una ruta para comparar: separadores y sin barra final. */
export function normalize(path: string): string {
  return path.replace(/\\/g, "/").replace(/\/+$/, "");
}
