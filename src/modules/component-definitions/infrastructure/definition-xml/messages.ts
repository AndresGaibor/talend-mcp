/**
 * Lector del `<nombre>_messages.properties` que acompaña al XML de cada componente.
 *
 * Ese fichero guarda las etiquetas visibles en Studio, con estas claves:
 *   - `<PARAM>.NAME` etiqueta de un parametro; `<PARAM>.HELP` su ayuda;
 *   - `<PARAM>.ITEM.<VALOR>` etiqueta de una opcion de lista;
 *   - `<PARAM>.ITEM.<COLUMNA>` etiqueta de una columna de tabla, y
 *     `<PARAM>.ITEM.<COLUMNA>.ITEM.<VALOR>` la de sus opciones;
 *   - `<GRUPO>.NAME` nombre de un grupo; `LONG_NAME` nombre del componente; `HELP` su clave de ayuda.
 *
 * Formato `clave=valor`, UTF-8. Se ignoran las lineas en blanco y los comentarios (`#` o `!`).
 */

/** Convierte el texto de un `.properties` en un mapa clave -> valor. */
export function parseMessagesProperties(text: string): Record<string, string> {
  const messages: Record<string, string> = {};
  const withoutBom = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  for (const rawLine of withoutBom.split(/\r?\n/)) {
    const line = rawLine.replace(/^\s+/, "");
    if (line === "" || line.startsWith("#") || line.startsWith("!")) continue;

    const separator = line.indexOf("=");
    if (separator <= 0) continue;

    const key = line.slice(0, separator).trim();
    const value = unescapeProperty(line.slice(separator + 1).trim());
    if (key) messages[key] = value;
  }

  return messages;
}

/** Escapes basicos de Java properties: `\"`, `\\`, `\'`, `\n`, `\t` y `\r`. Cualquier otro `\x` deja la `x`. */
function unescapeProperty(value: string): string {
  return value.replace(/\\(.)/g, (_match, char: string) => {
    switch (char) {
      case "n":
        return "\n";
      case "t":
        return "\t";
      case "r":
        return "\r";
      default:
        return char;
    }
  });
}
