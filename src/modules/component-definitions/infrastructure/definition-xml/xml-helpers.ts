import { XMLParser } from "fast-xml-parser";

/**
 * Utilidades de lectura del XML de Talend.
 *
 * Los atributos llegan con el prefijo `@_` y los valores por defecto vienen
 * como elemento hijo (`<DEFAULT>...</DEFAULT>`), no como atributo: los dos
 * casos se contemplan.
 */

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  parseAttributeValue: false,
  parseTagValue: false,
});

export type Bag = Record<string, unknown>;

export function asBag(value: unknown): Bag {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Bag) : {};
}

export function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

/** Atributo XML (`@_NAME`), con alternativa sin prefijo. */
export function attr(bag: Bag, key: string): string | undefined {
  const upper = key.toUpperCase();
  const raw = bag[`@_${upper}`] ?? bag[upper] ?? bag[key];
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw === "object") return undefined;
  return String(raw);
}

export function flag(bag: Bag, key: string, fallback: boolean): boolean {
  const raw = attr(bag, key);
  if (raw === undefined) return fallback;
  return raw === "true" || raw === "1";
}

/**
 * Texto de un elemento que puede ser texto plano o un objeto con `#text`.
 */
export function textOf(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  const bag = asBag(value);
  const inner = bag["#text"];
  if (inner !== undefined && inner !== null) return String(inner);
  return undefined;
}

/** `<DEFAULT>` puede ser atributo o elemento hijo. */
export function defaultValueOf(parameter: Bag): string | undefined {
  const fromAttribute = attr(parameter, "DEFAULT");
  if (fromAttribute !== undefined) return fromAttribute;
  return textOf(parameter["DEFAULT"] ?? parameter["default"]);
}

/** Instancia compartida del parser de XML. */
export function parseXmlBag(xml: string): unknown {
  return parser.parse(xml);
}
