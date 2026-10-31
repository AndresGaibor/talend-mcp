/**
 * Un candado por job.
 *
 * El cliente MCP puede mandar dos llamadas a la vez sobre el mismo job
 * (`verify` y `execute`, por ejemplo). Las dos abren el job en Studio,
 * compilan y ejecutan: la segunda pisa el estado de la primera y las dos
 * dejan editores abiertos. Con este candado, las operaciones sobre el mismo
 * job van en fila; las de jobs distintos siguen en paralelo.
 *
 * No es un limite de concurrencia global: solo serializa lo que comparte job.
 */

/** Cola de espera por job. La clave va en minusculas: Studio no distingue mayusculas. */
const colas = new Map<string, Promise<void>>();

/** Clave para las operaciones que actuan sobre el job abierto en Studio. */
export const JOB_ACTIVO = "__job_activo__";

/**
 * Ejecuta `fn` cuando no haya otra operacion en curso sobre el mismo job.
 *
 * Si la operacion anterior falla, esta se ejecuta igual: el fallo de una no
 * bloquea a las siguientes.
 */
export async function conCandadoDeJob<T>(
  job: string | undefined,
  fn: () => Promise<T>,
): Promise<T> {
  const clave = job ? job.toLowerCase() : JOB_ACTIVO;
  const anterior = colas.get(clave) ?? Promise.resolve();

  let liberar!: () => void;
  const turno = new Promise<void>((resolve) => {
    liberar = resolve;
  });
  const enCurso = anterior.then(() => turno, () => turno);
  colas.set(clave, enCurso);

  await anterior.catch(() => undefined);
  try {
    return await fn();
  } finally {
    liberar();
    // Si nadie mas se encolo detras, se suelta la clave para no crecer sin fin.
    if (colas.get(clave) === enCurso) {
      colas.delete(clave);
    }
  }
}
