import { XMLParser } from "fast-xml-parser";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  allowBooleanAttributes: true,
  parseAttributeValue: false,
  trimValues: false,
});

export function parseXml(xml: string): unknown {
  return parser.parse(xml);
}

export function asArray<T>(valor: T | T[] | undefined | null): T[] {
  if (valor === undefined || valor === null) return [];
  return Array.isArray(valor) ? valor : [valor];
}