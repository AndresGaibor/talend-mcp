/**
 * Acumulador de salida con tope.
 *
 * Los procesos que lanza el MCP (jobs exportados, scripts de Studio) escriben
 * en stdout/stderr sin limite. Acumular todo en un string deja que un job
 * verboso o un bucle de log agote el heap del servidor. Esta clase se queda
 * con el final, que es donde aparecen los errores, y avisa del recorte.
 */

/** Tope por defecto por flujo: 2 millones de caracteres (~4 MB en UTF-16). */
export const MAX_SALIDA_POR_DEFECTO = 2_000_000;

/** Margen para no recortar en cada trozo: se recorta de golpe al pasarse. */
const MARGEN = 65_536;

export class SalidaAcotada {
  private texto = "";
  private recortada = false;

  constructor(private readonly maximo: number = MAX_SALIDA_POR_DEFECTO) {}

  append(trozo: string): void {
    this.texto += trozo;
    if (this.texto.length > this.maximo) {
      this.recortada = true;
    }
    // El recorte fisico se hace de golpe, no en cada trozo: el buffer puede
    // pasar del tope hasta el margen, y nada mas.
    if (this.texto.length > this.maximo + MARGEN) {
      this.texto = this.texto.slice(this.texto.length - this.maximo);
    }
  }

  /** El texto acumulado, ya recortado si hizo falta. */
  get value(): string {
    return this.texto.length > this.maximo
      ? this.texto.slice(this.texto.length - this.maximo)
      : this.texto;
  }

  /** Si se descarto el principio de la salida. */
  get truncada(): boolean {
    return this.recortada;
  }
}
