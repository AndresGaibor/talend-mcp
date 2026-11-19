import { mkdirSync } from "node:fs";

/**
 * Los clientes de escritorio lanzan el servidor desde una carpeta cualquiera, y el estado
 * (catalogo de componentes, auditoria, ejecuciones) cuelga de `process.cwd()/.talend-mcp`.
 * Con TALEND_MCP_HOME el proceso se ancla ahi al arrancar y todo el estado queda en un sitio fijo.
 * Debe importarse antes que cualquier modulo que lea el directorio actual.
 */
const home = process.env.TALEND_MCP_HOME?.trim();
if (home) {
  mkdirSync(home, { recursive: true });
  process.chdir(home);
}
