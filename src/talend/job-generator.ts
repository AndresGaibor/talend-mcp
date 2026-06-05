import { buildXml, parseXml } from "./xml";
import { createEmptyJobItemXml } from "./job-crud";
import { generateTalendId } from "./utils";
import { buildMapNodeData } from "./component-mappers";

export interface ComponentSpec {
  uniqueName: string;
  componentName: string;
  posX?: number;
  posY?: number;
  label?: string;
  parameters?: Record<string, string>;
  schema?: {
    name: string;
    connector?: string;
    columns: Array<{
      name: string;
      type?: string;
      length?: number;
      precision?: number;
      nullable?: boolean;
      key?: boolean;
      sourceType?: string;
      pattern?: string;
    }>;
  };
}

export interface ConnectionSpec {
  source: string;
  target: string;
  label: string;
  connectorName?: string;
  metaname?: string;
  uniqueName?: string;
}

export interface JobSpec {
  jobName: string;
  version?: string;
  defaultContext?: string;
  label?: string;
  description?: string;
  purpose?: string;
  folderPath?: string;
  components: ComponentSpec[];
  connections?: ConnectionSpec[];
}

function buildElementParameter(name: string, value: string, field = "TEXT"): Record<string, unknown> {
  return { "@_field": field, "@_name": name, "@_value": value };
}

type ColumnSpec = { name: string; type?: string; length?: number; precision?: number; nullable?: boolean; key?: boolean; sourceType?: string; pattern?: string };

function buildColumn(col: ColumnSpec): Record<string, unknown> {
  const node: Record<string, unknown> = { "@_name": col.name, "@_type": col.type ?? "id_String" };
  if (col.length !== undefined) node["@_length"] = String(col.length);
  if (col.precision !== undefined) node["@_precision"] = String(col.precision);
  if (col.nullable !== undefined) node["@_nullable"] = col.nullable ? "true" : "false";
  if (col.key !== undefined) node["@_key"] = col.key ? "true" : "false";
  if (col.sourceType !== undefined) node["@_sourceType"] = col.sourceType;
  if (col.pattern !== undefined) node["@_pattern"] = col.pattern;
  return node;
}

function buildComponentNode(spec: ComponentSpec): Record<string, unknown> {
  const parameters: Record<string, unknown>[] = [buildElementParameter("UNIQUE_NAME", spec.uniqueName)];
  if (spec.label) parameters.push(buildElementParameter("LABEL", spec.label));

  if (spec.parameters) {
    for (const [key, value] of Object.entries(spec.parameters)) {
      parameters.push(buildElementParameter(key, value));
    }
  }

  const node: Record<string, unknown> = {
    "@_xmi:id": generateTalendId(),
    "@_componentName": spec.componentName,
    elementParameter: parameters.length === 1 ? parameters[0] : parameters,
  };

  if (spec.posX !== undefined) node["@_posX"] = String(spec.posX);
  if (spec.posY !== undefined) node["@_posY"] = String(spec.posY);

  if (spec.schema && spec.schema.columns && Array.isArray(spec.schema.columns)) {
    const metadata: Record<string, unknown> = {
      "@_connector": spec.schema.connector ?? "FLOW",
      "@_label": spec.schema.name ?? spec.uniqueName,
      "@_name": spec.schema.name ?? spec.uniqueName,
      "@_xmi:id": generateTalendId(),
      column: spec.schema.columns.map((c) => buildColumn(c)),
    };
    node.metadata = metadata;
  }

  if (spec.componentName === "tMap") {
    node.nodeData = buildMapNodeData(spec.uniqueName);
  }

  return node;
}

function buildConnectionNode(spec: ConnectionSpec): Record<string, unknown> {
  const node: Record<string, unknown> = {
    "@_xmi:id": generateTalendId(),
    "@_source": spec.source,
    "@_target": spec.target,
    "@_label": spec.label,
    elementParameter: buildElementParameter("UNIQUE_NAME", spec.uniqueName ?? spec.label),
  };
  if (spec.connectorName) node["@_connectorName"] = spec.connectorName;
  if (spec.metaname) node["@_metaname"] = spec.metaname;
  return node;
}

export function buildJobItemXml(spec: JobSpec): { xml: string; rootId: string } {
  const version = spec.version ?? "0.1";
  const defaultContext = spec.defaultContext ?? "Default";
  const rootId = generateTalendId();

  if (spec.components.length === 0) {
    return { xml: createEmptyJobItemXml({ jobName: spec.jobName, version, defaultContext }), rootId };
  }

  const contextParam = spec.components.some((c) => c.componentName === "tFileInputDelimited" || c.componentName === "tDBInput")
    ? [{ "@_xmi:id": generateTalendId(), "@_name": "DEFAULT", "@_type": "id_String", "@_value": "" }]
    : [];

  const contextSection = {
    context: {
      "@_confirmationNeeded": "false",
      "@_hide": "false",
      "@_name": defaultContext,
      contextParameter: contextParam.length === 1 ? contextParam[0] : contextParam,
    },
  };

  const nodes = spec.components.map((c) => buildComponentNode(c));
  const nodeSection = nodes.length === 1 ? nodes[0] : nodes;

  let connectionSection: unknown = [];
  if (spec.connections && spec.connections.length > 0) {
    const connNodes = spec.connections.map((c) => buildConnectionNode(c));
    connectionSection = connNodes.length === 1 ? connNodes[0] : connNodes;
  }

  const root: Record<string, unknown> = {
    "@_xmi:version": "2.0",
    "@_xmlns:xmi": "http://www.omg.org/XMI",
    "@_xmlns:talendfile": "platform:/resource/org.talend.model/model/TalendFile.xsd",
    "@_xmi:id": rootId,
    "@_defaultContext": defaultContext,
    "@_jobType": "Standard",
  };

  Object.assign(root, contextSection);
  root.node = nodeSection;
  if (Array.isArray(connectionSection) ? connectionSection.length > 0 : connectionSection) {
    root.connection = connectionSection;
  }

  const doc = {
    "talendfile:ProcessType": root,
  };

  return { xml: buildXml(doc), rootId };
}

export function buildJobPropertiesXml(spec: JobSpec, rootItemId: string): string {
  const version = spec.version ?? "0.1";
  const itemFileName = `${spec.jobName}_${version}.item`;
  const propId = generateTalendId();
  const itemId = generateTalendId();
  const stateId = generateTalendId();

  const doc = {
    "xmi:XMI": {
      "@_xmi:version": "2.0",
      "@_xmlns:xmi": "http://www.omg.org/XMI",
      "@_xmlns:TalendProperties": "http://www.talend.org/properties",
      "TalendProperties:Property": {
        "@_xmi:id": generateTalendId(),
        "@_id": propId,
        "@_label": spec.label ?? spec.jobName,
        "@_version": version,
        "@_displayName": spec.label ?? spec.jobName,
        "@_purpose": spec.purpose ?? "",
        "@_description": spec.description ?? "",
        "@_item": itemId,
      },
      "TalendProperties:ItemState": {
        "@_xmi:id": stateId,
        "@_path": spec.folderPath ?? "",
      },
      "TalendProperties:ProcessItem": {
        "@_xmi:id": itemId,
        "@_property": propId,
        "@_state": stateId,
        process: { "@_href": `${itemFileName}#${rootItemId}` },
      },
    },
  };

  return buildXml(doc);
}

export function validateJobSpec(spec: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!spec || typeof spec !== "object") {
    return { valid: false, errors: ["Spec must be an object"] };
  }

  const s = spec as Record<string, unknown>;

  if (typeof s.jobName !== "string" || s.jobName.length === 0) {
    errors.push("jobName is required and must be a non-empty string");
  }

  if (!Array.isArray(s.components)) {
    errors.push("components is required and must be an array");
  } else {
    const uniqueNames = new Set<string>();
    for (let i = 0; i < s.components.length; i++) {
      const comp = s.components[i] as Record<string, unknown>;
      if (typeof comp.uniqueName !== "string") {
        errors.push(`components[${i}].uniqueName is required`);
      }
      if (typeof comp.componentName !== "string") {
        errors.push(`components[${i}].componentName is required`);
      }
      if (typeof comp.uniqueName === "string" && uniqueNames.has(comp.uniqueName)) {
        errors.push(`Duplicate uniqueName: ${comp.uniqueName}`);
      }
      if (typeof comp.uniqueName === "string") uniqueNames.add(comp.uniqueName);
    }
  }

  if (Array.isArray(s.connections)) {
    const connUniqueNames = new Set<string>();
    for (let i = 0; i < s.connections.length; i++) {
      const conn = s.connections[i] as Record<string, unknown>;
      if (typeof conn.source !== "string") {
        errors.push(`connections[${i}].source is required`);
      }
      if (typeof conn.target !== "string") {
        errors.push(`connections[${i}].target is required`);
      }
      if (typeof conn.label !== "string") {
        errors.push(`connections[${i}].label is required`);
      }
      if (typeof conn.uniqueName === "string" && connUniqueNames.has(conn.uniqueName)) {
        errors.push(`Duplicate connection uniqueName: ${conn.uniqueName}`);
      }
      if (typeof conn.uniqueName === "string") connUniqueNames.add(conn.uniqueName);
      else if (typeof conn.label === "string") connUniqueNames.add(conn.label);
    }
  }

  return { valid: errors.length === 0, errors };
}