import type { XmlRecord } from "./types";

/** Lectura de los atributos del XML de un análisis DQ. */

export function attr(nodo: XmlRecord | undefined, nombre: string): string | undefined {
  const valor = nodo?.[`@_${nombre}`];
  return typeof valor === "string" ? valor : undefined;
}

export function boolAttr(nodo: XmlRecord, nombre: string): boolean {
  const val = nodo[`@_${nombre}`];
  return val === "true" || val === true;
}

export function safeBoolAttr(nodo: XmlRecord | undefined, nombre: string): boolean {
  return nodo ? boolAttr(nodo, nombre) : false;
}

export function numAttr(nodo: XmlRecord, nombre: string): number | undefined {
  const val = nodo[`@_${nombre}`];
  if (val == null) return undefined;
  const n = Number(val);
  return isNaN(n) ? undefined : n;
}

export function safeNumAttr(nodo: XmlRecord | undefined, nombre: string): number | undefined {
  return nodo ? numAttr(nodo, nombre) : undefined;
}

export function extractIndicatorName(indicator: XmlRecord): string {
  const builtIn = indicator["builtInIndicatorDefinition"] as XmlRecord | undefined;
  const name = attr(builtIn, "name") ?? attr(builtIn, "label");
  if (name) return name;
  if (indicator["lowerValue"] || indicator["upperValue"]) return "Range";
  return "unknown";
}

export function extractIndicatorType(indicator: XmlRecord): string {
  return attr(indicator, "xsi:type") ?? "unknown";
}
