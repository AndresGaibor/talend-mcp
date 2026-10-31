import { join } from "node:path";

/**
 * Carpeta del historial de ejecuciones.
 *
 * `TALEND_MCP_RUNS_DIR` la mueve. El indice de ejecuciones usa esta misma
 * funcion, para que la retencion borre justo los archivos que se escriben.
 */
export function getRunsDir(): string {
  const configurada = process.env.TALEND_MCP_RUNS_DIR?.trim();
  return configurada ? configurada : join(process.cwd(), ".talend-mcp", "runs");
}

export function generateRunId(): string {
  const now = new Date();
  const ds = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
  return `run_${ds}`;
}
