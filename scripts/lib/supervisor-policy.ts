/**
 * Politica del supervisor del servidor MCP (decisiones puras, sin procesos).
 *
 * Caso real que lo motiva: el servidor MCP (puerto 3927) se apaga mientras
 * Studio y su bridge (3930) siguen sanos, y todo cliente falla con
 * "connection refused" hasta que alguien lo vuelve a levantar a mano.
 */

export interface HealthSample {
  /** `GET /healthz` del servidor MCP respondio. */
  mcpOk: boolean;
  /** `GET /ping` del bridge de Studio respondio. */
  bridgeOk: boolean;
  /** Marca de tiempo en milisegundos. */
  at: number;
}

/** Muestras caidas seguidas antes de reiniciar el MCP. */
export const FAILURES_BEFORE_RESTART = 3;

/** Espera antes del reinicio numero `restarts` (0 es el primero): 1, 2, 4, 8, 16 y 30 s. */
export function backoffMs(restarts: number): number {
  return Math.min(1000 * 2 ** restarts, 30_000);
}

/** El MCP se reinicia solo tras varias muestras caidas seguidas; Studio no se toca. */
export function decideMcpAction(history: HealthSample[]): "none" | "restart-mcp" {
  if (history.length < FAILURES_BEFORE_RESTART) return "none";
  const recent = history.slice(-FAILURES_BEFORE_RESTART);
  return recent.every((s) => !s.mcpOk) ? "restart-mcp" : "none";
}
