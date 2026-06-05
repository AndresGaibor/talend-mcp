import { buildXml } from "../../xml/xml-utils";
import type { ParsedJob } from "../../../domain/job/job.repository";
import type { TalendComponent, TalendConnection } from "../../../domain/job/job.entity";

export function generateTalendId(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  let result = "_";
  for (let i = 0; i < 22; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function buildElementParameter(name: string, value: string, field = "TEXT"): Record<string, unknown> {
  return { "@_field": field, "@_name": name, "@_value": value };
}

export function buildColumn(col: { name: string; type?: string; length?: number; precision?: number; nullable?: boolean; key?: boolean; sourceType?: string; pattern?: string }): Record<string, unknown> {
  const node: Record<string, unknown> = { "@_name": col.name, "@_type": col.type ?? "id_String" };
  if (col.length !== undefined) node["@_length"] = String(col.length);
  if (col.precision !== undefined) node["@_precision"] = String(col.precision);
  if (col.nullable !== undefined) node["@_nullable"] = col.nullable ? "true" : "false";
  if (col.key !== undefined) node["@_key"] = col.key ? "true" : "false";
  if (col.sourceType !== undefined) node["@_sourceType"] = col.sourceType;
  if (col.pattern !== undefined) node["@_pattern"] = col.pattern;
  return node;
}

export function buildComponentNode(comp: TalendComponent): Record<string, unknown> {
  const parameters: Record<string, unknown>[] = [buildElementParameter("UNIQUE_NAME", comp.uniqueName)];
  if (comp.label) parameters.push(buildElementParameter("LABEL", comp.label));

  if (comp.parameters) {
    for (const [key, value] of Object.entries(comp.parameters)) {
      parameters.push(buildElementParameter(key, value));
    }
  }

  const node: Record<string, unknown> = {
    "@_xmi:id": generateTalendId(),
    "@_componentName": comp.componentName,
    elementParameter: parameters.length === 1 ? parameters[0] : parameters,
  };

  const posX = comp.nodeAttributes?.posX;
  const posY = comp.nodeAttributes?.posY;
  if (posX !== undefined) node["@_posX"] = posX;
  if (posY !== undefined) node["@_posY"] = posY;

  if (comp.schemas && comp.schemas.length > 0 && comp.schemas[0]) {
    const schema = comp.schemas[0]!;
    const metadata: Record<string, unknown> = {
      "@_connector": schema.connector ?? "FLOW",
      "@_label": schema.label ?? schema.name ?? comp.uniqueName,
      "@_name": schema.name ?? comp.uniqueName,
      "@_xmi:id": generateTalendId(),
      column: schema.columns.map(c => buildColumn(c)),
    };
    node.metadata = metadata;
  }

  if (comp.rawNodeData) {
    node.nodeData = comp.rawNodeData;
  }

  return node;
}

export function buildConnectionNode(conn: TalendConnection): Record<string, unknown> {
  const node: Record<string, unknown> = {
    "@_xmi:id": generateTalendId(),
    "@_source": conn.source,
    "@_target": conn.target,
    "@_label": conn.label ?? "",
    elementParameter: buildElementParameter("UNIQUE_NAME", conn.uniqueName ?? conn.label ?? ""),
  };
  if (conn.connectorName) node["@_connectorName"] = conn.connectorName;
  if (conn.metaname) node["@_metaname"] = conn.metaname;
  return node;
}

export function buildJobXml(job: ParsedJob, defaultContext = "Default"): string {
  const contextSection = {
    context: {
      "@_confirmationNeeded": "false",
      "@_hide": "false",
      "@_name": defaultContext,
      contextParameter: job.contexts.length === 1 ? job.contexts.map(p => ({
        "@_xmi:id": generateTalendId(),
        "@_name": p.name,
        "@_type": p.type ?? "id_String",
        "@_value": p.value ?? "",
      })) : job.contexts.map(p => ({
        "@_xmi:id": generateTalendId(),
        "@_name": p.name,
        "@_type": p.type ?? "id_String",
        "@_value": p.value ?? "",
      })),
    },
  };

  const nodes = job.components.map(c => buildComponentNode(c));
  const nodeSection = nodes.length === 1 ? nodes[0] : nodes;

  let connectionSection: unknown = [];
  if (job.connections.length > 0) {
    const connNodes = job.connections.map(c => buildConnectionNode(c));
    connectionSection = connNodes.length === 1 ? connNodes[0] : connNodes;
  }

  const root: Record<string, unknown> = {
    "@_xmi:version": "2.0",
    "@_xmlns:xmi": "http://www.omg.org/XMI",
    "@_xmlns:talendfile": "platform:/resource/org.talend.model/model/TalendFile.xsd",
    "@_xmi:id": generateTalendId(),
    "@_defaultContext": defaultContext,
    "@_jobType": "Standard",
  };

  Object.assign(root, contextSection);
  root.node = nodeSection;
  if (Array.isArray(connectionSection) ? connectionSection.length > 0 : connectionSection) {
    root.connection = connectionSection;
  }

  return buildXml({
    "talendfile:ProcessType": root,
  });
}
