/**
 * Limites de una llamada a una tool.
 *
 * `tools/call` esperaba al handler sin plazo y sin tope de concurrencia: una
 * tool colgada dejaba la peticion abierta para siempre y N llamadas a la vez
 * abrian N procesos o compilaciones en Studio.
 */

/** La tool no termino dentro del plazo. */
export class ToolTimeoutError extends Error {
  constructor(readonly toolName: string, readonly timeoutMs: number) {
    super(`La tool ${toolName} no termino en ${timeoutMs} ms. Puede seguir trabajando en segundo plano.`);
    this.name = "ToolTimeoutError";
  }
}

/**
 * Ejecuta `fn` con un plazo.
 *
 * Al vencer se rechaza con {@link ToolTimeoutError}, pero la ejecucion sigue:
 * no hay forma de abortar un handler a medias sin su cooperacion. Se le pone un
 * `catch` para que su fallo tardio no quede como rejection sin manejar.
 */
export async function conTiempoLimite<T>(
  toolName: string,
  timeoutMs: number,
  fn: () => Promise<T>,
): Promise<T> {
  const ejecucion = fn();
  ejecucion.catch(() => undefined);

  let timer: ReturnType<typeof setTimeout> | undefined;
  const plazo = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new ToolTimeoutError(toolName, timeoutMs)), timeoutMs);
  });

  try {
    return await Promise.race([ejecucion, plazo]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Cupo de llamadas simultaneas; las que no entran se rechazan en el acto. */
export class CupoDeLlamadas {
  private enCurso = 0;

  constructor(private readonly maximo: number) {}

  get activas(): number {
    return this.enCurso;
  }

  /** Reserva un turno; false si ya estan todos ocupados. */
  intentarEntrar(): boolean {
    if (this.enCurso >= this.maximo) return false;
    this.enCurso++;
    return true;
  }

  salir(): void {
    if (this.enCurso > 0) this.enCurso--;
  }
}
