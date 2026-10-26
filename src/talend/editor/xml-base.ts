import { parseXml } from "../xml";
import type { ContextEditOptions, SchemaColumnEditOptions, XmlRecord } from "./types";

/**
 * Utilidades compartidas del editor XML.
 *
 * Todo el trabajo se hace sobre el arbol que devuelve `parseXml`: se busca el
 * nodo, se cambia el atributo y se vuelve a serializar con `buildXml`.
 */

export function attr(nodo: XmlRecord | undefined, nombre: string): string | undefined {
  const valor = nodo?.[`@_${nombre}`];
  return typeof valor === "string" ? valor : undefined;
}

export function setAttr(nodo: XmlRecord, nombre: string, valor: string | number | boolean | undefined): void {
  if (valor === undefined) return;
  nodo[`@_${nombre}`] = typeof valor === "boolean" ? (valor ? "true" : "false") : String(valor);
}

export function asArray<T>(valor: T | T[] | undefined | null): T[] {
  if (valor === undefined || valor === null) return [];
  return Array.isArray(valor) ? valor : [valor];
}

export function getParsedDocument(xml: string): Record<string, XmlRecord> {
  return parseXml(xml) as Record<string, XmlRecord>;
}

/**
 * Documento y raiz de un `.item`.
 *
 * Centraliza el error de XML invalido: todas las operaciones de job avisan
 * igual cuando falta `talendfile:ProcessType`.
 */
export function getDocumentAndRoot(xml: string): {
  document: Record<string, XmlRecord>;
  root: XmlRecord;
} {
  const document = getParsedDocument(xml);
  const root = document["talendfile:ProcessType"] ?? document.ProcessType;
  if (!root) throw new Error("XML de job Talend inválido: falta talendfile:ProcessType");
  return { document, root };
}

export function cloneRecord<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

export function findNodeByUniqueName(root: XmlRecord, uniqueName: string): XmlRecord {
  const nodes = asArray(root.node as XmlRecord | XmlRecord[] | undefined);
  const target = nodes.find((node) => {
    const parameters = asArray(node.elementParameter as XmlRecord | XmlRecord[] | undefined);
    return parameters.some(
      (parameter) => attr(parameter, "name") === "UNIQUE_NAME" && attr(parameter, "value") === uniqueName,
    );
  });

  if (!target) {
    throw new Error(`Componente no encontrado: ${uniqueName}`);
  }

  return target;
}

export function findSchema(root: XmlRecord, uniqueName: string, schemaName?: string): XmlRecord {
  const node = findNodeByUniqueName(root, uniqueName);
  const metadata = asArray(node.metadata as XmlRecord | XmlRecord[] | undefined);
  const schema = metadata.find((item) => {
    const name = attr(item, "name");
    const label = attr(item, "label");
    return name === (schemaName ?? uniqueName) || label === schemaName;
  });

  if (!schema) {
    throw new Error(`Schema no encontrado: ${schemaName ?? uniqueName}`);
  }

  return schema;
}

export function findContext(root: XmlRecord, contextName: string): XmlRecord {
  const contexts = asArray(root.context as XmlRecord | XmlRecord[] | undefined);
  const context = contexts.find((item) => attr(item, "name") === contextName);
  if (!context) throw new Error(`Contexto no encontrado: ${contextName}`);
  return context;
}

export function createElementParameter(name: string, value: string): XmlRecord {
  return { "@_name": name, "@_value": value };
}

export function createContextParameter(options: ContextEditOptions): XmlRecord {
  const parameter: XmlRecord = {
    "@_name": options.parameterName,
    "@_value": options.value,
  };
  if (options.type !== undefined) parameter["@_type"] = options.type;
  if (options.prompt !== undefined) parameter["@_prompt"] = options.prompt;
  return parameter;
}

export function updateElementParameters(node: XmlRecord, parameterName: string, value: string): boolean {
  const parameters = asArray(node.elementParameter as XmlRecord | XmlRecord[] | undefined);
  const existing = parameters.find((parameter) => attr(parameter, "name") === parameterName);

  if (existing) {
    existing["@_value"] = value;
    node.elementParameter = Array.isArray(node.elementParameter) ? parameters : parameters[0];
    return true;
  }

  const newParameter: XmlRecord = { "@_name": parameterName, "@_value": value };
  parameters.push(newParameter);
  node.elementParameter = parameters.length === 1 ? parameters[0] : parameters;
  return true;
}

export function updateColumnSchema(column: XmlRecord, patch: SchemaColumnEditOptions["patch"]): boolean {
  let changed = false;

  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    setAttr(column, key, value);
    changed = true;
  }

  return changed;
}

/** Diff linea a linea: `-` para lo que se va y `+` para lo que llega. */
export function diffText(before: string, after: string): string {
  if (before === after) return "";
  const antes = before.split("\n");
  const despues = after.split("\n");
  const lineas: string[] = [];
  const max = Math.max(antes.length, despues.length);

  for (let i = 0; i < max; i += 1) {
    const a = antes[i];
    const b = despues[i];
    if (a === b) continue;
    if (a !== undefined) lineas.push(`- ${a}`);
    if (b !== undefined) lineas.push(`+ ${b}`);
  }

  return lineas.join("\n");
}
