/**
 * Medida de tiempos del arnes L5.
 *
 * Con `L5_TIEMPOS=1` cada fase se anota en stderr con su duracion, para saber
 * donde se va el tiempo de un escenario. Sin la variable no cambia nada: la
 * accion se ejecuta igual y no se imprime nada.
 */
export async function medir<T>(etiqueta: string, accion: () => Promise<T>): Promise<T> {
  if (process.env.L5_TIEMPOS !== "1") return accion();
  const inicio = performance.now();
  try {
    return await accion();
  } finally {
    console.error(`[tiempo] ${etiqueta} ${Math.round(performance.now() - inicio)} ms`);
  }
}
