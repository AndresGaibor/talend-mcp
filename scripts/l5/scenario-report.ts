import { existsSync, readFileSync, writeFileSync } from "node:fs";

import type { Escenario, Resultado } from "./scenario-types";

/**
 * Informe CSV del arnes (`testdata/resultados-l5.csv`).
 *
 * Se lee y escribe con comillas correctas: el detalle de un fallo puede traer
 * comas y saltos de linea, y una fila partida haria que `--solo-fallidos`
 * eligiera los escenarios equivocados.
 */

export const CABECERA_CSV = "escenario,job,ejecuta_ok,salida_correcta,detalle";

/** Escapa un campo solo si lo necesita (coma, comilla o salto de linea). */
export function escaparCampo(valor: string): string {
  return /[",\r\n]/.test(valor) ? `"${valor.replace(/"/g, '""')}"` : valor;
}

/** Separa una linea CSV respetando las comillas dobles. */
export function parsearLinea(linea: string): string[] {
  const campos: string[] = [];
  let actual = "";
  let entreComillas = false;

  for (let indice = 0; indice < linea.length; indice++) {
    const caracter = linea[indice]!;
    if (entreComillas) {
      if (caracter === '"') {
        if (linea[indice + 1] === '"') {
          actual += '"';
          indice++;
        } else {
          entreComillas = false;
        }
      } else {
        actual += caracter;
      }
    } else if (caracter === '"') {
      entreComillas = true;
    } else if (caracter === ",") {
      campos.push(actual);
      actual = "";
    } else {
      actual += caracter;
    }
  }
  campos.push(actual);
  return campos;
}

/** Filas del informe anterior: nombre del escenario y linea original. */
export function leerResultados(ruta: string): Map<string, string> {
  const filas = new Map<string, string>();
  if (!existsSync(ruta)) return filas;
  for (const linea of readFileSync(ruta, "utf8").split(/\r?\n/).slice(1)) {
    if (!linea.trim()) continue;
    const nombre = parsearLinea(linea)[0] ?? "";
    if (nombre) filas.set(nombre, linea);
  }
  return filas;
}

/** Linea CSV de un escenario ejecutado. */
export function filaResultado(escenario: Escenario, detalle: Resultado): string {
  // El mensaje solo muestra los primeros avisos: el informe guarda todos.
  const completos = detalle.avisos && detalle.avisos.length > 3
    ? `avisos completos (${detalle.avisos.length}): ${detalle.avisos.join(" | ")}`
    : "";
  const detalleFila = [detalle.mensaje, completos].filter(Boolean).join("; ");
  return [
    escenario.nombre,
    escenario.job,
    detalle.ejecutaOk ? "si" : "no",
    detalle.salidaCorrecta ? "si" : "no",
    detalleFila,
  ]
    .map(escaparCampo)
    .join(",");
}

/** Escribe el informe completo (cabecera y filas ya ordenadas por el llamador). */
export function escribirResultados(ruta: string, filas: Iterable<string>): void {
  writeFileSync(ruta, `${[CABECERA_CSV, ...filas].join("\n")}\n`, "utf8");
}

/** Nombres que salieron bien en el informe (escenario y salida correctos). */
export function nombresOk(ruta: string): Set<string> {
  if (!existsSync(ruta)) return new Set();
  const nombres = new Set<string>();
  for (const linea of readFileSync(ruta, "utf8").split(/\r?\n/).slice(1)) {
    if (!linea.trim()) continue;
    const campos = parsearLinea(linea);
    if (campos[2] === "si" && campos[3] === "si") nombres.add(campos[0] ?? "");
  }
  nombres.delete("");
  return nombres;
}

/** Nombres que no salieron bien en el informe anterior. */
export function nombresFallidos(ruta: string): Set<string> {
  if (!existsSync(ruta)) {
    throw new Error(`No existe el informe anterior ${ruta}; ejecuta primero una suite completa.`);
  }
  const nombres = new Set<string>();
  for (const linea of readFileSync(ruta, "utf8").split(/\r?\n/).slice(1)) {
    if (!linea.trim()) continue;
    const campos = parsearLinea(linea);
    if (campos[2] !== "si" || campos[3] !== "si") nombres.add(campos[0] ?? "");
  }
  nombres.delete("");
  return nombres;
}
