import { mkdirSync } from "node:fs";

/**
 * Los clientes de escritorio lanzan el servidor desde una carpeta cualquiera, y el estado
 * (catalogo de componentes, auditoria, ejecuciones) cuelga de `process.cwd()/.talend-mcp`.
 * Con TALEND_MCP_HOME el proceso se ancla ahi y todo el estado queda en un sitio fijo.
 * Se ejecuta al importar el modulo, que debe ser el primero en cargarse.
 */
export function anchorStateHome(home = process.env.TALEND_MCP_HOME?.trim()): void {
  if (!home) return;
  mkdirSync(home, { recursive: true });
  process.chdir(home);
}

anchorStateHome();
