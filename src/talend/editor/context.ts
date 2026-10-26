import { buildXml } from "../xml";
import {
  asArray,
  attr,
  createContextParameter,
  diffText,
  findContext,
  getDocumentAndRoot,
} from "./xml-base";
import type { ContextEditOptions, EditResult, XmlRecord } from "./types";

/** Parametros de contexto: actualizar, crear si falta y borrar. */

export function updateTalendContextParameterXml(xml: string, options: ContextEditOptions): string {
  const { document, root } = getDocumentAndRoot(xml);

  const context = findContext(root, options.contextName);
  const parameters = asArray(context.contextParameter as XmlRecord | XmlRecord[] | undefined);
  const target = parameters.find((parameter) => attr(parameter, "name") === options.parameterName);
  if (!target) throw new Error(`Parametro de contexto no encontrado: ${options.parameterName}`);

  target["@_value"] = options.value;
  if (options.type !== undefined) target["@_type"] = options.type;
  if (options.prompt !== undefined) target["@_prompt"] = options.prompt;
  context.contextParameter = Array.isArray(context.contextParameter) ? parameters : parameters[0];
  return buildXml(document);
}

export function upsertTalendContextParameterXml(xml: string, options: ContextEditOptions): string {
  const { document, root } = getDocumentAndRoot(xml);

  const contexts = asArray(root.context as XmlRecord | XmlRecord[] | undefined);
  const context = contexts.find((item) => attr(item, "name") === options.contextName);
  if (!context) throw new Error(`Contexto no encontrado: ${options.contextName}`);

  const parameters = asArray(context.contextParameter as XmlRecord | XmlRecord[] | undefined);
  const target = parameters.find((parameter) => attr(parameter, "name") === options.parameterName);
  if (target) {
    target["@_value"] = options.value;
    if (options.type !== undefined) target["@_type"] = options.type;
    if (options.prompt !== undefined) target["@_prompt"] = options.prompt;
  } else {
    parameters.push(createContextParameter(options));
  }

  context.contextParameter = parameters.length === 1 ? parameters[0] : parameters;
  root.context = Array.isArray(root.context) ? contexts : contexts[0];
  return buildXml(document);
}

export function deleteTalendContextParameterXml(
  xml: string,
  options: { contextName: string; parameterName: string },
): string {
  const { document, root } = getDocumentAndRoot(xml);

  const contexts = asArray(root.context as XmlRecord | XmlRecord[] | undefined);
  const context = contexts.find((item) => attr(item, "name") === options.contextName);
  if (!context) throw new Error(`Contexto no encontrado: ${options.contextName}`);

  const parameters = asArray(context.contextParameter as XmlRecord | XmlRecord[] | undefined);
  const filtered = parameters.filter((parameter) => attr(parameter, "name") !== options.parameterName);
  if (filtered.length === parameters.length) {
    throw new Error(`Parametro de contexto no encontrado: ${options.parameterName}`);
  }

  context.contextParameter = filtered.length === 1 ? filtered[0] : filtered;
  root.context = Array.isArray(root.context) ? contexts : contexts[0];
  return buildXml(document);
}

export function buildTalendContextEditPreview(
  xml: string,
  options: ({ mode: "update" } | { mode: "upsert" }) & ContextEditOptions,
): EditResult {
  const before = xml;
  const after =
    options.mode === "update"
      ? updateTalendContextParameterXml(xml, options)
      : upsertTalendContextParameterXml(xml, options);

  return {
    xml: after,
    changed: before !== after,
    diff: diffText(before, after),
  };
}

export function buildTalendContextDeletePreview(
  xml: string,
  options: { contextName: string; parameterName: string },
): EditResult {
  const before = xml;
  const after = deleteTalendContextParameterXml(xml, options);

  return {
    xml: after,
    changed: before !== after,
    diff: diffText(before, after),
  };
}
