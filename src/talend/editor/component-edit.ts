import { buildXml } from "../xml";
import {
  asArray,
  attr,
  diffText,
  findNodeByUniqueName,
  findSchema,
  getDocumentAndRoot,
  setAttr,
  updateColumnSchema,
  updateElementParameters,
} from "./xml-base";
import type {
  EditResult,
  ParameterEditOptions,
  SchemaColumnEditOptions,
  XmlRecord,
} from "./types";

/** Edicion de parametros y columnas de un componente. */

export function patchTalendComponentXml(xml: string, uniqueName: string, patch: Record<string, string>): string {
  const { document, root } = getDocumentAndRoot(xml);
  const target = findNodeByUniqueName(root, uniqueName);
  for (const [parameterName, value] of Object.entries(patch)) {
    updateElementParameters(target, parameterName, value);
  }
  return buildXml(document);
}

export function updateTalendComponentParameterXml(xml: string, options: ParameterEditOptions): string {
  const { document, root } = getDocumentAndRoot(xml);
  const target = findNodeByUniqueName(root, options.uniqueName);
  updateElementParameters(target, options.parameterName, options.value);
  return buildXml(document);
}

export function updateTalendSchemaColumnXml(xml: string, options: SchemaColumnEditOptions): string {
  const { document, root } = getDocumentAndRoot(xml);
  const schema = findSchema(root, options.uniqueName, options.schemaName);
  const columns = asArray(schema.column as XmlRecord | XmlRecord[] | undefined);
  const target = columns.find((column) => attr(column, "name") === options.columnName);

  if (!target) {
    throw new Error(`Columna no encontrada: ${options.columnName}`);
  }

  if (options.patch.name !== undefined) setAttr(target, "name", options.patch.name);
  updateColumnSchema(target, options.patch);
  schema.column = Array.isArray(schema.column) ? columns : columns[0];
  return buildXml(document);
}

export function buildTalendComponentEditPreview(
  xml: string,
  options:
    | ({ kind: "parameter" } & ParameterEditOptions)
    | ({ kind: "schema-column" } & SchemaColumnEditOptions),
): EditResult {
  const before = xml;
  const after =
    options.kind === "parameter"
      ? updateTalendComponentParameterXml(xml, options)
      : updateTalendSchemaColumnXml(xml, options);

  return {
    xml: after,
    changed: before !== after,
    diff: diffText(before, after),
  };
}
