/**
 * Resultado de un lote de compilacion: los Jobs que el bridge no devolvio.
 *
 * `talend_job_build_batch` puede contestar `ok` con un mapa `jobs` vacio o
 * incompleto: pasa cuando los Jobs no estan en el repositorio de Studio (por
 * ejemplo, recien escritos por fichero sin refrescar el workspace) o cuando el
 * lote se corta. Un mapa vacio no es un lote correcto: los Jobs pedidos quedan
 * como no compilados, con su motivo, para que el llamador no los cuente como
 * buenos.
 */

export type EstadoDeJobEnLote = {
  ok?: boolean;
  error?: unknown;
};

export type CuerpoDeLote = {
  jobs?: Record<string, EstadoDeJobEnLote>;
  [clave: string]: unknown;
};

/** Codigo del error de un Job pedido que no aparece en la respuesta del bridge. */
export const CODIGO_SIN_ESTADO = "JOB_SIN_ESTADO_EN_LA_RESPUESTA";

/** Motivo que se le pone a un Job pedido sin estado en la respuesta. */
export function motivoSinEstado(nombre: string): string {
  return (
    `El bridge no devolvio estado para ${nombre}: puede que no este en el repositorio de Studio ` +
    "(refresca el workspace antes de compilar) o que el lote se cortara. No se cuenta como compilado."
  );
}

/**
 * Devuelve el cuerpo con un estado `ok: false` por cada Job pedido que falte.
 *
 * Si estan todos, devuelve el mismo objeto y una lista de faltantes vacia.
 */
export function completarJobsFaltantes(
  pedidos: readonly string[],
  cuerpo: CuerpoDeLote,
): { cuerpo: CuerpoDeLote; faltantes: string[] } {
  const estados = cuerpo.jobs ?? {};
  const faltantes = pedidos.filter((nombre) => !(nombre in estados));
  if (faltantes.length === 0) {
    return { cuerpo, faltantes };
  }

  const completos: Record<string, EstadoDeJobEnLote> = { ...estados };
  for (const nombre of faltantes) {
    completos[nombre] = {
      ok: false,
      error: { code: CODIGO_SIN_ESTADO, message: motivoSinEstado(nombre) },
    };
  }

  return { cuerpo: { ...cuerpo, jobs: completos }, faltantes };
}

/** Aviso para la respuesta: cuantos Jobs quedaron sin estado y cuales. */
export function avisoDeFaltantes(faltantes: readonly string[]): string | undefined {
  if (faltantes.length === 0) return undefined;
  const muestra = faltantes.slice(0, 5).join(", ");
  const resto = faltantes.length > 5 ? ` y ${faltantes.length - 5} mas` : "";
  return (
    `El bridge no devolvio estado para ${faltantes.length} Job(s): ${muestra}${resto}. ` +
    "Quedan como no compilados; refresca el workspace y repitelo."
  );
}
