import * as z from "zod/v4";
import { buildXml } from "../xml";
import { buildColumn, type ColumnSpec } from "../job-generator/columns";
import { buildComponentNode, buildConnectionNode } from "../job-generator/component-node";
import { generateTalendId } from "../utils";
import {
  asArray,
  attr,
  diffText,
  findNodeByUniqueName,
  getDocumentAndRoot,
  setAttr,
  updateElementParameters,
} from "./xml-base";
import type { EditResult, XmlRecord } from "./types";

/**
 * Edicion de un `.item` sin Studio, por lotes y atomica.
 *
 * Aplica una lista de operaciones sobre el mismo documento y, antes de devolver el XML, comprueba la integridad
 * del job (nombres unicos, conexiones con extremos que existen). Si algo falla no se devuelve nada: el llamador
 * no escribe un job a medias.
 */

const columnSchema = z.object({
  name: z.string().min(1),
  type: z.string().optional(),
  length: z.number().int().optional(),
  precision: z.number().int().optional(),
  nullable: z.boolean().optional(),
  key: z.boolean().optional(),
  sourceType: z.string().optional(),
  pattern: z.string().optional(),
});

const parameterValueSchema = z.union([z.string(), z.object({ value: z.string(), field: z.string().optional() })]);

export const jobEditOperationSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("add_node"),
    uniqueName: z.string().min(1),
    componentName: z.string().min(1),
    componentVersion: z.string().optional(),
    label: z.string().optional(),
    posX: z.number().optional(),
    posY: z.number().optional(),
    parameters: z.record(z.string(), parameterValueSchema).optional(),
    columns: z.array(columnSchema).optional(),
  }),
  z.object({ op: z.literal("remove_node"), uniqueName: z.string().min(1) }),
  z.object({
    op: z.literal("set_params"),
    uniqueName: z.string().min(1),
    parameters: z.record(z.string(), z.string()),
  }),
  z.object({
    op: z.literal("set_schema"),
    uniqueName: z.string().min(1),
    columns: z.array(columnSchema).min(1),
    connector: z.string().optional(),
  }),
  z.object({
    op: z.literal("connect"),
    source: z.string().min(1),
    target: z.string().min(1),
    label: z.string().min(1),
    connectorName: z.string().optional(),
    metaname: z.string().optional(),
    uniqueName: z.string().optional(),
  }),
  z.object({ op: z.literal("disconnect"), uniqueName: z.string().min(1) }),
  z.object({ op: z.literal("move"), uniqueName: z.string().min(1), posX: z.number(), posY: z.number() }),
  z.object({
    op: z.literal("set_context"),
    contextName: z.string().optional(),
    name: z.string().min(1),
    type: z.string().optional(),
    value: z.string(),
    comment: z.string().optional(),
  }),
]);

export type JobEditOperation = z.infer<typeof jobEditOperationSchema>;

function uniqueNameOf(record: XmlRecord): string | undefined {
  const parameter = asArray(record.elementParameter as XmlRecord | XmlRecord[] | undefined).find(
    (item) => attr(item, "name") === "UNIQUE_NAME",
  );
  return attr(parameter, "value");
}

function nodesOf(root: XmlRecord): XmlRecord[] {
  return asArray(root.node as XmlRecord | XmlRecord[] | undefined);
}

function connectionsOf(root: XmlRecord): XmlRecord[] {
  return asArray(root.connection as XmlRecord | XmlRecord[] | undefined);
}

function store(root: XmlRecord, key: "node" | "connection", items: XmlRecord[]): void {
  if (items.length === 0) delete root[key];
  else root[key] = items.length === 1 ? items[0] : items;
}

function applyOperation(root: XmlRecord, operation: JobEditOperation): void {
  switch (operation.op) {
    case "add_node": {
      if (nodesOf(root).some((node) => uniqueNameOf(node) === operation.uniqueName)) {
        throw new Error(`Ya existe un componente ${operation.uniqueName}`);
      }
      const node = buildComponentNode({
        uniqueName: operation.uniqueName,
        componentName: operation.componentName,
        componentVersion: operation.componentVersion,
        label: operation.label,
        posX: operation.posX ?? 160,
        posY: operation.posY ?? 96,
        parameters: operation.parameters,
        schema: operation.columns
          ? { name: operation.uniqueName, connector: "FLOW", columns: operation.columns as ColumnSpec[] }
          : undefined,
      });
      store(root, "node", [...nodesOf(root), node as XmlRecord]);
      return;
    }
    case "remove_node": {
      const nodes = nodesOf(root);
      const kept = nodes.filter((node) => uniqueNameOf(node) !== operation.uniqueName);
      if (kept.length === nodes.length) throw new Error(`Componente no encontrado: ${operation.uniqueName}`);
      store(root, "node", kept);
      store(
        root,
        "connection",
        connectionsOf(root).filter(
          (conn) => attr(conn, "source") !== operation.uniqueName && attr(conn, "target") !== operation.uniqueName,
        ),
      );
      return;
    }
    case "set_params": {
      const target = findNodeByUniqueName(root, operation.uniqueName);
      for (const [name, value] of Object.entries(operation.parameters)) updateElementParameters(target, name, value);
      return;
    }
    case "set_schema": {
      const target = findNodeByUniqueName(root, operation.uniqueName);
      const connector = operation.connector ?? "FLOW";
      const columns = operation.columns.map((column) => buildColumn(column as ColumnSpec));
      const metadata = asArray(target.metadata as XmlRecord | XmlRecord[] | undefined);
      const existing = metadata.find((item) => attr(item, "connector") === connector);
      if (existing) {
        existing.column = columns;
      } else {
        metadata.push({
          "@_connector": connector,
          "@_label": operation.uniqueName,
          "@_name": operation.uniqueName,
          "@_xmi:id": generateTalendId(),
          column: columns,
        });
      }
      target.metadata = metadata.length === 1 ? metadata[0] : metadata;
      return;
    }
    case "connect": {
      store(root, "connection", [
        ...connectionsOf(root),
        buildConnectionNode({
          source: operation.source,
          target: operation.target,
          label: operation.label,
          connectorName: operation.connectorName,
          metaname: operation.metaname,
          uniqueName: operation.uniqueName,
        }) as XmlRecord,
      ]);
      return;
    }
    case "disconnect": {
      const connections = connectionsOf(root);
      const kept = connections.filter((conn) => uniqueNameOf(conn) !== operation.uniqueName);
      if (kept.length === connections.length) throw new Error(`Conexion no encontrada: ${operation.uniqueName}`);
      store(root, "connection", kept);
      return;
    }
    case "move": {
      const target = findNodeByUniqueName(root, operation.uniqueName);
      setAttr(target, "posX", operation.posX);
      setAttr(target, "posY", operation.posY);
      return;
    }
    case "set_context": {
      const contexts = asArray(root.context as XmlRecord | XmlRecord[] | undefined);
      const wanted = operation.contextName ?? attr(root, "defaultContext") ?? "Default";
      const context = contexts.find((item) => attr(item, "name") === wanted);
      if (!context) throw new Error(`Contexto no encontrado: ${wanted}`);
      const parameters = asArray(context.contextParameter as XmlRecord | XmlRecord[] | undefined);
      const existing = parameters.find((item) => attr(item, "name") === operation.name);
      const target: XmlRecord = existing ?? { "@_xmi:id": generateTalendId(), "@_name": operation.name };
      target["@_value"] = operation.value;
      target["@_type"] = operation.type ?? attr(target, "type") ?? "id_String";
      target["@_comment"] = operation.comment ?? attr(target, "comment") ?? "";
      if (!existing) parameters.push(target);
      context.contextParameter = parameters.length === 1 ? parameters[0] : parameters;
      return;
    }
  }
}

/** Problemas de integridad del job: lista vacia si es consistente. */
export function checkJobIntegrity(root: XmlRecord): string[] {
  const problems: string[] = [];
  const names = nodesOf(root).map(uniqueNameOf);
  const seen = new Set<string>();
  for (const name of names) {
    if (!name) problems.push("Hay un componente sin UNIQUE_NAME");
    else if (seen.has(name)) problems.push(`UNIQUE_NAME repetido: ${name}`);
    else seen.add(name);
  }
  const connectionNames = new Set<string>();
  for (const conn of connectionsOf(root)) {
    const source = attr(conn, "source");
    const target = attr(conn, "target");
    const name = uniqueNameOf(conn) ?? attr(conn, "label") ?? "?";
    if (!source || !seen.has(source)) problems.push(`La conexion ${name} sale de '${source}', que no existe`);
    if (!target || !seen.has(target)) problems.push(`La conexion ${name} llega a '${target}', que no existe`);
    if (connectionNames.has(name)) problems.push(`Nombre de conexion repetido: ${name}`);
    connectionNames.add(name);
  }
  return problems;
}

/**
 * Aplica las operaciones en orden. Lanza un error con el indice de la operacion que falla o con los problemas
 * de integridad del resultado.
 */
export function applyJobEdits(xml: string, operations: JobEditOperation[]): EditResult {
  const { document, root } = getDocumentAndRoot(xml);
  operations.forEach((operation, index) => {
    try {
      applyOperation(root, operation);
    } catch (error) {
      throw new Error(`Operacion ${index + 1} (${operation.op}): ${error instanceof Error ? error.message : String(error)}`);
    }
  });
  const problems = checkJobIntegrity(root);
  if (problems.length > 0) throw new Error(`El job quedaria inconsistente: ${problems.join("; ")}`);
  const after = buildXml(document);
  return { xml: after, changed: after !== xml, diff: diffText(xml, after) };
}
