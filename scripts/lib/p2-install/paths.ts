import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

/** Rutas y nombres que p2 guarda en sus caches. */

/**
 * Ruta estable donde se copia el update site antes de instalar.
 *
 * Se usa una ruta fija (y no una temporal) porque p2 cachea los repositorios
 * en el area de datos de la instalacion: si la ruta cambia en cada ejecucion,
 * el cache queda obsoleto y p2 intenta releer rutas inexistentes.
 */
export function stagingRepositoryPath(): string {
  const root = join(process.env.LOCALAPPDATA ?? join(homedir(), ".talend-mcp"), "talend-mcp");
  const dir = join(root, "bridge-repository");
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** Convierte el nombre que p2 guarda en el cache a una ruta local, si se puede. */
export function referencedPath(name: string): string | null {
  let value = name.trim();

  const prefix = value.match(/^(?:update site|reference|site)\s*:\s*(.+)$/i);
  if (prefix) value = prefix[1]!;

  if (value.startsWith("file:///")) {
    value = decodeURIComponent(value.slice("file:///".length));
    value = value.replace(/\//g, "\\");
    return value;
  }

  if (/^[a-zA-Z]:[\\/]/.test(value) || value.startsWith("/") || value.startsWith("\\")) {
    return value;
  }

  return null;
}

/** Una ubicacion es un update site de p2 si tiene los marcadores estandar. */
export function isUpdateSite(path: string): boolean {
  const markers = ["p2.index", "content.xml", "content.jar", "content.xml.xz"];
  return markers.some((marker) => existsSync(join(path, marker)));
}

/** Despliega los escapes de los archivos de preferencias de Eclipse. */
export function unescapePrefsValue(value: string): string {
  return value.replace(/\\:/g, ":").replace(/\\\\/g, "\\");
}
