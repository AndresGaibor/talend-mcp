/**
 * Reintentos y errores transitorios de Talend Studio.
 *
 * Studio contesta "ocupado" mientras compila o mientras hay un modal abierto.
 * Esas respuestas no son un fallo del escenario: se espera y se repite.
 */

/** Mensaje corto de una respuesta del bridge. */
export function errorDe(respuesta: { error?: { message?: string }; rawText?: string }): string {
  return respuesta.error?.message ?? respuesta.rawText?.slice(0, 300) ?? "error desconocido";
}

/**
 * Los fallos de Studio que se pasan solos.
 *
 * Esta ocupado compilando, hay un modal abierto o el editor del job no
 * responde a la primera: el bridge avisa, se espera y se repite la accion.
 * El aviso "No se pudo abrir el job ... en el editor" aparece tambien con
 * jobs del usuario, asi que no es un problema del escenario.
 */
export function transitorioDeStudio(mensaje: string): boolean {
  return (
    mensaje.includes("No se pudo abrir el job") ||
    mensaje.includes("hilo de la interfaz") ||
    mensaje.includes("ocupado")
  );
}

/** Mensajes que da el bridge mientras el build sigue en marcha. */
export function compilando(error: string): boolean {
  return (
    error.includes("no esta compilado") ||
    error.includes("No se encontro la clase principal")
  );
}

export type ReintentoOptions = {
  intentos?: number;
  /** Espera entre intentos; se puede acortar en pruebas. */
  esperaMs?: number;
};

/**
 * Repite una llamada mientras Studio este ocupado.
 *
 * Se espera y se vuelve a intentar solo si `interesa` acepta el mensaje; un
 * error real se devuelve en el primer intento.
 */
export async function reintentar<T extends { ok: boolean; error?: { message?: string } }>(
  accion: () => Promise<T>,
  interesa: (mensaje: string) => boolean,
  options: ReintentoOptions = {},
): Promise<T> {
  const intentos = options.intentos ?? 12;
  const esperaMs = options.esperaMs ?? 5000;
  let ultima = await accion();
  for (let intento = 0; intento < intentos && !ultima.ok; intento++) {
    const mensaje = ultima.error?.message ?? "";
    if (!interesa(mensaje)) break;
    await new Promise((resolve) => setTimeout(resolve, esperaMs));
    ultima = await accion();
  }
  return ultima;
}

/** Espera asincrona del arnes (se aísla para poder probarla sin dormir). */
export function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
