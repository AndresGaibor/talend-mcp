import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Catalogo de componentes generado por el servidor
 * (`.talend-mcp/component-catalog.json`).
 *
 * Se cachea en memoria: el archivo lo escribe otra herramienta y no cambia
 * durante la validacion.
 */
let cachedCatalog: any = null;

export function getCatalog(): any {
  if (cachedCatalog) return cachedCatalog;
  const catalogPath = join(process.cwd(), ".talend-mcp", "component-catalog.json");
  if (existsSync(catalogPath)) {
    try {
      cachedCatalog = JSON.parse(readFileSync(catalogPath, "utf8"));
    } catch {
      // Ignore errors
    }
  }
  return cachedCatalog;
}
