import { buildXml } from "../xml";
import {
  asArray,
  attr,
  cloneRecord,
  createElementParameter,
  diffText,
  findNodeByUniqueName,
  getDocumentAndRoot,
  setAttr,
} from "./xml-base";
import type {
  AddConnectionOptions,
  DeleteComponentOptions,
  DeleteConnectionOptions,
  DuplicateComponentOptions,
  EditResult,
  MoveComponentOptions,
  XmlRecord,
} from "./types";

/** Alta, borrado, duplicado y movimiento de nodos y conexiones. */

export function duplicateTalendComponentXml(xml: string, options: DuplicateComponentOptions): string {
  const { document, root } = getDocumentAndRoot(xml);

  const nodes = asArray(root.node as XmlRecord | XmlRecord[] | undefined);
  const source = findNodeByUniqueName(root, options.sourceUniqueName);
  const clone = cloneRecord(source);
  const parameters = asArray(clone.elementParameter as XmlRecord | XmlRecord[] | undefined);
  const uniqueParameter = parameters.find((parameter) => attr(parameter, "name") === "UNIQUE_NAME");

  if (uniqueParameter) {
    uniqueParameter["@_value"] = options.targetUniqueName;
  } else {
    parameters.unshift(createElementParameter("UNIQUE_NAME", options.targetUniqueName));
  }

  clone.elementParameter = parameters.length === 1 ? parameters[0] : parameters;
  nodes.push(clone);
  root.node = nodes;
  return buildXml(document);
}

export function addTalendConnectionXml(xml: string, options: AddConnectionOptions): string {
  const { document, root } = getDocumentAndRoot(xml);

  const connections = asArray(root.connection as XmlRecord | XmlRecord[] | undefined);
  connections.push({
    "@_connectorName": options.connectorName,
    "@_label": options.label,
    "@_metaname": options.metaname,
    "@_source": options.sourceUniqueName,
    "@_target": options.targetUniqueName,
    elementParameter: createElementParameter("UNIQUE_NAME", options.uniqueName),
  });
  root.connection = connections;
  return buildXml(document);
}

export function deleteTalendComponentXml(xml: string, options: DeleteComponentOptions): string {
  const { document, root } = getDocumentAndRoot(xml);

  const nodes = asArray(root.node as XmlRecord | XmlRecord[] | undefined);
  const filtered = nodes.filter((node) => {
    const parameters = asArray(node.elementParameter as XmlRecord | XmlRecord[] | undefined);
    return !parameters.some(
      (parameter) => attr(parameter, "name") === "UNIQUE_NAME" && attr(parameter, "value") === options.uniqueName,
    );
  });

  if (filtered.length === nodes.length) throw new Error(`Componente no encontrado: ${options.uniqueName}`);

  const connections = asArray(root.connection as XmlRecord | XmlRecord[] | undefined);
  const filteredConnections = connections.filter((conn) => {
    const source = attr(conn, "source");
    const target = attr(conn, "target");
    return source !== options.uniqueName && target !== options.uniqueName;
  });

  root.node = filtered.length === 1 ? filtered[0] : filtered;
  root.connection = filteredConnections.length === 1 ? filteredConnections[0] : filteredConnections;

  return buildXml(document);
}

export function deleteTalendConnectionXml(xml: string, options: DeleteConnectionOptions): string {
  const { document, root } = getDocumentAndRoot(xml);

  const connections = asArray(root.connection as XmlRecord | XmlRecord[] | undefined);
  const filtered = connections.filter((conn) => {
    const parameters = asArray(conn.elementParameter as XmlRecord | XmlRecord[] | undefined);
    return !parameters.some(
      (parameter) => attr(parameter, "name") === "UNIQUE_NAME" && attr(parameter, "value") === options.uniqueName,
    );
  });

  if (filtered.length === connections.length) throw new Error(`Conexión no encontrada: ${options.uniqueName}`);

  root.connection = filtered.length === 1 ? filtered[0] : filtered;
  return buildXml(document);
}

export function moveTalendComponentXml(xml: string, options: MoveComponentOptions): string {
  const { document, root } = getDocumentAndRoot(xml);

  const nodes = asArray(root.node as XmlRecord | XmlRecord[] | undefined);
  const target = nodes.find((node) => {
    const parameters = asArray(node.elementParameter as XmlRecord | XmlRecord[] | undefined);
    return parameters.some(
      (parameter) => attr(parameter, "name") === "UNIQUE_NAME" && attr(parameter, "value") === options.uniqueName,
    );
  });

  if (!target) throw new Error(`Componente no encontrado: ${options.uniqueName}`);

  setAttr(target, "posX", options.posX);
  setAttr(target, "posY", options.posY);
  root.node = nodes;
  return buildXml(document);
}

export function buildTalendComponentDeletePreview(xml: string, options: DeleteComponentOptions): EditResult {
  const before = xml;
  const after = deleteTalendComponentXml(xml, options);
  return { xml: after, changed: before !== after, diff: diffText(before, after) };
}

export function buildTalendConnectionDeletePreview(xml: string, options: DeleteConnectionOptions): EditResult {
  const before = xml;
  const after = deleteTalendConnectionXml(xml, options);
  return { xml: after, changed: before !== after, diff: diffText(before, after) };
}
