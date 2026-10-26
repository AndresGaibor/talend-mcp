/**
 * Lectura de argumentos de los CLI.
 *
 * Acepta `--clave valor` y `--clave=valor`; el resto son posicionales.
 */
export function argumento(args: readonly string[], nombre: string): string | undefined {
  const prefijo = `--${nombre}=`;
  const inline = args.find((arg) => arg.startsWith(prefijo));
  if (inline) return inline.slice(prefijo.length);
  const indice = args.indexOf(`--${nombre}`);
  return indice >= 0 ? args[indice + 1] : undefined;
}

/** Primer argumento que no es una opcion ni el valor de una de ellas. */
export function posicional(
  args: readonly string[],
  opcionesConValor: readonly string[] = [],
): string | undefined {
  return args.find(
    (arg, index) => !arg.startsWith("--") && !opcionesConValor.includes(args[index - 1] ?? ""),
  );
}
