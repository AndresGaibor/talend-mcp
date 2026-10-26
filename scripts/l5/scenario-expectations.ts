import type { Espera, EsperaFichero } from "./scenario-types";

/**
 * Comparacion de la salida con lo que el escenario declaro antes de ejecutar.
 *
 * Cada funcion devuelve la lista de fallos con los valores esperado y real;
 * una lista vacia significa que la comprobacion paso.
 */

/** Lineas exactas o solo el numero de lineas, y textos que tienen que aparecer. */
export function compararSalida(
  espera: Pick<Espera, "lineas" | "contiene">,
  lineas: string[],
): string[] {
  const fallos: string[] = [];

  if (espera.lineas !== undefined) {
    if (typeof espera.lineas === "number") {
      if (lineas.length !== espera.lineas) {
        fallos.push(`salieron ${lineas.length} lineas y se esperaban ${espera.lineas}`);
      }
    } else {
      const mismo =
        espera.lineas.length === lineas.length &&
        espera.lineas.every((linea, indice) => linea === lineas[indice]);
      if (!mismo) {
        fallos.push(
          `las lineas no son las esperadas: se esperaba ${JSON.stringify(espera.lineas)} y salio ${JSON.stringify(lineas.slice(0, 6))}`,
        );
      }
    }
  }

  for (const texto of espera.contiene ?? []) {
    if (!lineas.some((linea) => linea.includes(texto))) {
      fallos.push(`no aparece '${texto}' en la salida`);
    }
  }

  return fallos;
}

/**
 * Contenido del fichero que escribe el job.
 *
 * `contenido` es null cuando el fichero no existe.
 */
export function compararFichero(
  espera: EsperaFichero,
  contenido: string[] | null,
  ruta: string,
): string[] {
  if (contenido === null) {
    return [
      `no se escribio el fichero ${ruta}: el job no lo ha creado. ` +
        `Revisa FILENAME del tFileOutputDelimited y que exista su carpeta de destino`,
    ];
  }

  const fallos: string[] = [];
  if (Array.isArray(espera.lineas)) {
    // Las lineas exactas, en orden: es la unica forma de comprobar el orden
    // en que escriben varios subjobs (un tPrejob y un tPostjob).
    const mismo =
      espera.lineas.length === contenido.length &&
      espera.lineas.every((linea, indice) => linea === contenido[indice]);
    if (!mismo) {
      fallos.push(
        `el fichero no tiene las lineas esperadas: se esperaba ${JSON.stringify(espera.lineas)} y salio ${JSON.stringify(contenido.slice(0, 8))}`,
      );
    }
  } else if (espera.lineas !== undefined && contenido.length !== espera.lineas) {
    fallos.push(`el fichero tiene ${contenido.length} lineas y se esperaban ${espera.lineas}`);
  }

  for (const texto of espera.contiene ?? []) {
    if (!contenido.some((linea) => linea.includes(texto))) {
      fallos.push(`el fichero no contiene '${texto}'`);
    }
  }
  return fallos;
}

/** Valor que devolvio la consulta de comprobacion (null si fallo). */
export function compararConsulta(
  consulta: { sql: string; valor: string | number },
  valor: string | number | null,
): string[] {
  if (valor === null) return [`la consulta fallo: ${consulta.sql}`];
  if (String(valor) !== String(consulta.valor)) {
    return [`la consulta devolvio '${valor}' y se esperaba '${consulta.valor}'`];
  }
  return [];
}

/** Contextos del job con las variables declaradas. */
export function compararContextos(
  esperados: NonNullable<Espera["contextos"]>,
  reales: Array<{ name: string; parameters?: Array<{ name: string; value: string }> }>,
): string[] {
  const fallos: string[] = [];
  for (const esperado of esperados) {
    const contexto = reales.find((item) => item.name === esperado.nombre);
    if (!contexto) {
      fallos.push(`el job no tiene el contexto '${esperado.nombre}'`);
      continue;
    }
    for (const variable of esperado.variables) {
      const encontrada = (contexto.parameters ?? []).find((item) => item.name === variable.nombre);
      if (!encontrada) {
        fallos.push(`el contexto '${esperado.nombre}' no tiene la variable '${variable.nombre}'`);
      } else if (encontrada.value !== variable.valor) {
        fallos.push(
          `en '${esperado.nombre}', '${variable.nombre}' vale '${encontrada.value}' y se esperaba '${variable.valor}'`,
        );
      }
    }
  }
  return fallos;
}
