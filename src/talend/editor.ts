import { buildXml, parseXml } from "./xml";

type XmlRecord = Record<string, unknown>;

type EditResult = {
  xml: string;
  changed: boolean;
  diff: string;
};

type ParameterEditOptions = {
  uniqueName: string;
  parameterName: string;
  value: string;
};

type SchemaColumnEditOptions = {
  uniqueName: string;
  schemaName: string;
  columnName: string;
  patch: {
    name?: string;
    type?: string;
    length?: number;
    precision?: number;
    nullable?: boolean;
    key?: boolean;
    sourceType?: string;
    pattern?: string;
  };
};

type DuplicateComponentOptions = {
  sourceUniqueName: string;
  targetUniqueName: string;
};

type AddConnectionOptions = {
  sourceUniqueName: string;
  targetUniqueName: string;
  label: string;
  connectorName: string;
  metaname: string;
  uniqueName: string;
};

type ContextEditOptions = {
  contextName: string;
  parameterName: string;
  value: string;
  type?: string;
  prompt?: string;
};

type JobPropertiesEditOptions = {
  label?: string;
  description?: string;
  purpose?: string;
};

function attr(nodo: XmlRecord | undefined, nombre: string): string | undefined {
  const valor = nodo?.[`@_${nombre}`];
  return typeof valor === "string" ? valor : undefined;
}

function setAttr(nodo: XmlRecord, nombre: string, valor: string | number | boolean | undefined): void {
  if (valor === undefined) return;
  nodo[`@_${nombre}`] = typeof valor === "boolean" ? (valor ? "true" : "false") : String(valor);
}

function asArray<T>(valor: T | T[] | undefined | null): T[] {
  if (valor === undefined || valor === null) return [];
  return Array.isArray(valor) ? valor : [valor];
}

function getRoot(xml: string): XmlRecord {
  const document = getParsedDocument(xml);
  const root = document["talendfile:ProcessType"] ?? document.ProcessType;
  if (!root) throw new Error("XML de job Talend inválido: falta talendfile:ProcessType");
  return root;
}

function getParsedDocument(xml: string): Record<string, XmlRecord> {
  return parseXml(xml) as Record<string, XmlRecord>;
}

function cloneRecord<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function findNodeByUniqueName(root: XmlRecord, uniqueName: string): XmlRecord {
  const nodes = asArray(root.node as XmlRecord | XmlRecord[] | undefined);
  const target = nodes.find((node) => {
    const parameters = asArray(node.elementParameter as XmlRecord | XmlRecord[] | undefined);
    return parameters.some((parameter) => attr(parameter, "name") === "UNIQUE_NAME" && attr(parameter, "value") === uniqueName);
  });

  if (!target) {
    throw new Error(`Componente no encontrado: ${uniqueName}`);
  }

  return target;
}

function findSchema(root: XmlRecord, uniqueName: string, schemaName?: string): XmlRecord {
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

function findContext(root: XmlRecord, contextName: string): XmlRecord {
  const contexts = asArray(root.context as XmlRecord | XmlRecord[] | undefined);
  const context = contexts.find((item) => attr(item, "name") === contextName);
  if (!context) throw new Error(`Contexto no encontrado: ${contextName}`);
  return context;
}

function createElementParameter(name: string, value: string): XmlRecord {
  return { "@_name": name, "@_value": value };
}

function createContextParameter(options: ContextEditOptions): XmlRecord {
  const parameter: XmlRecord = {
    "@_name": options.parameterName,
    "@_value": options.value,
  };
  if (options.type !== undefined) parameter["@_type"] = options.type;
  if (options.prompt !== undefined) parameter["@_prompt"] = options.prompt;
  return parameter;
}

function ensureArrayNode<T>(value: T | T[] | undefined | null): T[] {
  return asArray(value);
}

function updateElementParameters(node: XmlRecord, parameterName: string, value: string): boolean {
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

function updateColumnSchema(column: XmlRecord, patch: SchemaColumnEditOptions["patch"]): boolean {
  let changed = false;

  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    setAttr(column, key, value);
    changed = true;
  }

  return changed;
}

function diffText(before: string, after: string): string {
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

export function patchTalendComponentXml(xml: string, uniqueName: string, patch: Record<string, string>): string {
  const document = getParsedDocument(xml);
  const root = document["talendfile:ProcessType"] ?? document.ProcessType;
  if (!root) throw new Error("XML de job Talend inválido: falta talendfile:ProcessType");
  const target = findNodeByUniqueName(root, uniqueName);
  for (const [parameterName, value] of Object.entries(patch)) {
    updateElementParameters(target, parameterName, value);
  }
  return buildXml(document);
}

export function updateTalendComponentParameterXml(xml: string, options: ParameterEditOptions): string {
  const document = getParsedDocument(xml);
  const root = document["talendfile:ProcessType"] ?? document.ProcessType;
  if (!root) throw new Error("XML de job Talend inválido: falta talendfile:ProcessType");
  const target = findNodeByUniqueName(root, options.uniqueName);
  updateElementParameters(target, options.parameterName, options.value);
  return buildXml(document);
}

export function updateTalendSchemaColumnXml(xml: string, options: SchemaColumnEditOptions): string {
  const document = getParsedDocument(xml);
  const root = document["talendfile:ProcessType"] ?? document.ProcessType;
  if (!root) throw new Error("XML de job Talend inválido: falta talendfile:ProcessType");
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

export function duplicateTalendComponentXml(xml: string, options: DuplicateComponentOptions): string {
  const document = getParsedDocument(xml);
  const root = document["talendfile:ProcessType"] ?? document.ProcessType;
  if (!root) throw new Error("XML de job Talend inválido: falta talendfile:ProcessType");

  const nodes = ensureArrayNode(root.node as XmlRecord | XmlRecord[] | undefined);
  const source = findNodeByUniqueName(root, options.sourceUniqueName);
  const clone = cloneRecord(source);
  const parameters = ensureArrayNode(clone.elementParameter as XmlRecord | XmlRecord[] | undefined);
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
  const document = getParsedDocument(xml);
  const root = document["talendfile:ProcessType"] ?? document.ProcessType;
  if (!root) throw new Error("XML de job Talend inválido: falta talendfile:ProcessType");

  const connections = ensureArrayNode(root.connection as XmlRecord | XmlRecord[] | undefined);
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

export function updateTalendContextParameterXml(xml: string, options: ContextEditOptions): string {
  const document = getParsedDocument(xml);
  const root = document["talendfile:ProcessType"] ?? document.ProcessType;
  if (!root) throw new Error("XML de job Talend inválido: falta talendfile:ProcessType");

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
  const document = getParsedDocument(xml);
  const root = document["talendfile:ProcessType"] ?? document.ProcessType;
  if (!root) throw new Error("XML de job Talend inválido: falta talendfile:ProcessType");

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

export function deleteTalendContextParameterXml(xml: string, options: { contextName: string; parameterName: string }): string {
  const document = getParsedDocument(xml);
  const root = document["talendfile:ProcessType"] ?? document.ProcessType;
  if (!root) throw new Error("XML de job Talend inválido: falta talendfile:ProcessType");

  const contexts = asArray(root.context as XmlRecord | XmlRecord[] | undefined);
  const context = contexts.find((item) => attr(item, "name") === options.contextName);
  if (!context) throw new Error(`Contexto no encontrado: ${options.contextName}`);

  const parameters = asArray(context.contextParameter as XmlRecord | XmlRecord[] | undefined);
  const filtered = parameters.filter((parameter) => attr(parameter, "name") !== options.parameterName);
  if (filtered.length === parameters.length) throw new Error(`Parametro de contexto no encontrado: ${options.parameterName}`);

  context.contextParameter = filtered.length === 1 ? filtered[0] : filtered;
  root.context = Array.isArray(root.context) ? contexts : contexts[0];
  return buildXml(document);
}

export function updateTalendJobPropertiesXml(xml: string, options: JobPropertiesEditOptions): string {
  const document = parseXml(xml) as Record<string, XmlRecord>;
  const root = document["xmi:XMI"];
  if (!root) throw new Error("XML de properties Talend inválido: falta xmi:XMI");

  const property = root["TalendProperties:Property"] as XmlRecord | undefined;
  if (!property) throw new Error("XML de properties Talend inválido: falta TalendProperties:Property");

  if (options.label !== undefined) property["@_label"] = options.label;
  if (options.description !== undefined) property["@_description"] = options.description;
  if (options.purpose !== undefined) property["@_purpose"] = options.purpose;
  return buildXml(document);
}

export function buildTalendContextEditPreview(
  xml: string,
  options: ({ mode: "update" } | { mode: "upsert" }) & ContextEditOptions,
): EditResult {
  const before = xml;
  const after = options.mode === "update"
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

export function buildTalendJobPropertiesEditPreview(xml: string, options: JobPropertiesEditOptions): EditResult {
  const before = xml;
  const after = updateTalendJobPropertiesXml(xml, options);

  return {
    xml: after,
    changed: before !== after,
    diff: diffText(before, after),
  };
}

type DeleteComponentOptions = {
  uniqueName: string;
};

type DeleteConnectionOptions = {
  uniqueName: string;
};

type MoveComponentOptions = {
  uniqueName: string;
  posX: number;
  posY: number;
};

export function deleteTalendComponentXml(xml: string, options: DeleteComponentOptions): string {
  const document = getParsedDocument(xml);
  const root = document["talendfile:ProcessType"] ?? document.ProcessType;
  if (!root) throw new Error("XML de job Talend inválido: falta talendfile:ProcessType");

  const nodes = ensureArrayNode(root.node as XmlRecord | XmlRecord[] | undefined);
  const filtered = nodes.filter((node) => {
    const parameters = asArray(node.elementParameter as XmlRecord | XmlRecord[] | undefined);
    return !parameters.some((p) => attr(p, "name") === "UNIQUE_NAME" && attr(p, "value") === options.uniqueName);
  });

  if (filtered.length === nodes.length) throw new Error(`Componente no encontrado: ${options.uniqueName}`);

  const connections = ensureArrayNode(root.connection as XmlRecord | XmlRecord[] | undefined);
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
  const document = getParsedDocument(xml);
  const root = document["talendfile:ProcessType"] ?? document.ProcessType;
  if (!root) throw new Error("XML de job Talend inválido: falta talendfile:ProcessType");

  const connections = ensureArrayNode(root.connection as XmlRecord | XmlRecord[] | undefined);
  const filtered = connections.filter((conn) => {
    const parameters = asArray(conn.elementParameter as XmlRecord | XmlRecord[] | undefined);
    return !parameters.some((p) => attr(p, "name") === "UNIQUE_NAME" && attr(p, "value") === options.uniqueName);
  });

  if (filtered.length === connections.length) throw new Error(`Conexión no encontrada: ${options.uniqueName}`);

  root.connection = filtered.length === 1 ? filtered[0] : filtered;
  return buildXml(document);
}

export function moveTalendComponentXml(xml: string, options: MoveComponentOptions): string {
  const document = getParsedDocument(xml);
  const root = document["talendfile:ProcessType"] ?? document.ProcessType;
  if (!root) throw new Error("XML de job Talend inválido: falta talendfile:ProcessType");

  const nodes = ensureArrayNode(root.node as XmlRecord | XmlRecord[] | undefined);
  const target = nodes.find((node) => {
    const parameters = asArray(node.elementParameter as XmlRecord | XmlRecord[] | undefined);
    return parameters.some((p) => attr(p, "name") === "UNIQUE_NAME" && attr(p, "value") === options.uniqueName);
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

export function buildTalendComponentEditPreview(
  xml: string,
  options:
    | ({ kind: "parameter" } & ParameterEditOptions)
    | ({ kind: "schema-column" } & SchemaColumnEditOptions),
): EditResult {
  const before = xml;
  const after = options.kind === "parameter"
    ? updateTalendComponentParameterXml(xml, options)
    : updateTalendSchemaColumnXml(xml, options);

  return {
    xml: after,
    changed: before !== after,
    diff: diffText(before, after),
  };
}
