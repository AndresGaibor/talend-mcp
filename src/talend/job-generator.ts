import { buildXml, parseXml } from "./xml";
import { createEmptyJobItemXml } from "./job-crud";
import { generateTalendId } from "./utils";
import { buildMapNodeData } from "./component-mappers";
import { buildColumn } from "./job-generator/columns";

/**
 * Valor de un parametro de componente.
 *
 * Un string simple se escribe como `field="TEXT"`. Para los parametros que
 * Talend tipa de otra forma (FILE, CHECK, RADIO, DIRECTORY, COMPONENT_LIST)
 * se puede indicar el campo explicitamente.
 */
export type ParameterValue = string | { value: string; field?: string };

export interface ComponentSpec {
  uniqueName: string;
  componentName: string;
  /** Version del componente en Talend (por ejemplo 0.102). Sin ella Studio no resuelve el componente. */
  componentVersion?: string;
  posX?: number;
  posY?: number;
  label?: string;
  parameters?: Record<string, ParameterValue>;
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

export interface ContextParamSpec {
  name: string;
  type: string;
  value: string;
  comment?: string;
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
  contexts?: ContextParamSpec[];
}

function buildElementParameter(name: string, value: string, field = "TEXT"): Record<string, unknown> {
  return { "@_field": field, "@_name": name, "@_value": value };
}

export { normalizeColumnType } from "./job-generator/columns";

function buildComponentNode(spec: ComponentSpec): Record<string, unknown> {
  const parameters: Record<string, unknown>[] = [buildElementParameter("UNIQUE_NAME", spec.uniqueName)];
  if (spec.label) parameters.push(buildElementParameter("LABEL", spec.label));

  if (spec.parameters) {
    for (const [key, raw] of Object.entries(spec.parameters)) {
      if (raw !== null && typeof raw === "object" && !Array.isArray(raw) && "value" in raw) {
        const typed = raw as { value: string; field?: string };
        parameters.push(buildElementParameter(key, typed.value, typed.field ?? "TEXT"));
        continue;
      }
      if (typeof raw === "object" && raw !== null) {
        parameters.push({
          "@_field": "TABLE",
          "@_name": key,
          elementValue: raw,
        });
      } else {
        parameters.push(buildElementParameter(key, raw as string));
      }
    }
  }

  // `tLogRow` necesita varios parametros que el generador de codigo de Talend
  // lee sin comprobar que existan. Si faltan, falla con
  // `NumberFormatException: For input string: "Main1100Main1"`.
  //
  //   LENGTHS                tabla con un par SCHEMA_COLUMN/LENGTH por columna
  //   PRINT_CONTENT_WITH_LOG4J  registra con log4j en vez del main del job
  //   SCHEMA_OPT_NUM         limite de filas que imprime el log
  //
  // Ver docs/TALEND-STUDIO-INTERNALS.md.
  if (spec.componentName === "tLogRow") {
    const lengths = buildLogRowLengths(spec);
    if (lengths && !("LENGTHS" in (spec.parameters ?? {}))) {
      parameters.push({ "@_field": "TABLE", "@_name": "LENGTHS", elementValue: lengths });
    }

    if (!("PRINT_CONTENT_WITH_LOG4J" in (spec.parameters ?? {}))) {
      parameters.push(buildElementParameter("PRINT_CONTENT_WITH_LOG4J", "true", "CHECK"));
    }

    if (!("SCHEMA_OPT_NUM" in (spec.parameters ?? {}))) {
      parameters.push(buildElementParameter("SCHEMA_OPT_NUM", "100", "TEXT"));
    }
  }

  const node: Record<string, unknown> = {
    "@_xmi:id": generateTalendId(),
    "@_componentName": spec.componentName,
    elementParameter: parameters.length === 1 ? parameters[0] : parameters,
  };

  if (spec.componentVersion) node["@_componentVersion"] = spec.componentVersion;
  if (spec.posX !== undefined) node["@_posX"] = String(spec.posX);
  if (spec.posY !== undefined) node["@_posY"] = String(spec.posY);

  if (spec.schema && spec.schema.columns && Array.isArray(spec.schema.columns)) {
    // El nombre del metadata es el unique name del componente. Usar el nombre
    // de la primera columna deja el modelo de Studio inconsistente.
    const metadataName = spec.schema.name ?? spec.uniqueName;
    const metadata: Record<string, unknown> = {
      "@_connector": spec.schema.connector ?? "FLOW",
      "@_label": metadataName,
      "@_name": metadataName,
      "@_xmi:id": generateTalendId(),
      column: spec.schema.columns.map((c) => buildColumn(c)),
    };
    node.metadata = metadata;
  }

  if (spec.componentName === "tMap") {
    node.nodeData = (spec as any).nodeData ?? buildMapNodeData(spec.uniqueName);
  }

  return node;
}

/**
 * Tabla `LENGTHS` de `tLogRow`: un par SCHEMA_COLUMN/LENGTH por columna.
 *
 * La longitud por defecto es 10, que es la que usan los jobs de Talend.
 */
function buildLogRowLengths(spec: ComponentSpec): Record<string, unknown>[] | null {
  const columns = spec.schema?.columns;
  if (!Array.isArray(columns) || columns.length === 0) {
    return null;
  }

  const values: Record<string, unknown>[] = [];
  let id = 0;
  for (const column of columns) {
    values.push({ "@_elementRef": "SCHEMA_COLUMN", "@_value": column.name, "@_id": String(id++) });
    values.push({ "@_elementRef": "LENGTH", "@_value": String(column.length ?? 10), "@_id": String(id++) });
  }
  return values;
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

  let contextParam: Record<string, unknown>[] = [];
  if (spec.contexts && spec.contexts.length > 0) {
    contextParam = spec.contexts.map((ctx) => ({
      "@_xmi:id": generateTalendId(),
      "@_name": ctx.name,
      "@_type": ctx.type,
      "@_value": ctx.value,
      "@_comment": ctx.comment ?? "",
    }));
  }
  // Sin variables de contexto, el `context` va vacio, como en los jobs que
  // escribe el propio Studio. Poner un `contextParameter` llamado DEFAULT
  // rompe la resolucion de variables: Studio lo interpola en los valores de
  // los parametros del componente y el job falla al generar codigo.

  const context: Record<string, unknown> = {
    "@_confirmationNeeded": "false",
    "@_hide": "false",
    "@_name": defaultContext,
  };
  // Sin variables de contexto el elemento va vacio, como en los jobs que
  // escribe el propio Studio. Un `contextParameter` vacio no es lo mismo.
  if (contextParam.length === 1) {
    context.contextParameter = contextParam[0];
  } else if (contextParam.length > 1) {
    context.contextParameter = contextParam;
  }

  const contextSection = { context };

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

export { validateJobSpec } from "./job-spec-validator";

export interface JobletSpec {
  jobletName: string;
  version?: string;
  defaultContext?: string;
  label?: string;
  description?: string;
  purpose?: string;
  folderPath?: string;
  components: ComponentSpec[];
  connections?: ConnectionSpec[];
  contexts?: ContextParamSpec[];
}

export function buildJobletItemXml(spec: JobletSpec): { xml: string; rootId: string } {
  const version = spec.version ?? "0.1";
  const defaultContext = spec.defaultContext ?? "Default";
  const rootId = generateTalendId();

  let contextParam: Record<string, unknown>[] = [];
  if (spec.contexts && spec.contexts.length > 0) {
    contextParam = spec.contexts.map((ctx) => ({
      "@_xmi:id": generateTalendId(),
      "@_name": ctx.name,
      "@_type": ctx.type,
      "@_value": ctx.value,
      "@_comment": ctx.comment ?? "",
    }));
  }

  const context: Record<string, unknown> = {
    "@_confirmationNeeded": "false",
    "@_hide": "false",
    "@_name": defaultContext,
  };
  // Sin variables de contexto el elemento va vacio, como en los jobs que
  // escribe el propio Studio. Un `contextParameter` vacio no es lo mismo.
  if (contextParam.length === 1) {
    context.contextParameter = contextParam[0];
  } else if (contextParam.length > 1) {
    context.contextParameter = contextParam;
  }

  const contextSection = { context };

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
    "@_xmlns:model": "http://www.talend.com/joblet.ecore",
    "@_xmlns:TalendProperties": "http://www.talend.org/properties",
    "@_xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
    "@_xmlns:TalendMapper": "http://www.talend.org/mapper",
    "model:JobletProcess": {
      "@_xmi:id": rootId,
      "@_defaultContext": defaultContext,
      context: contextSection.context,
      parameters: {
        "@_xmi:id": generateTalendId(),
      },
      node: nodeSection,
      connection: connectionSection,
    },
    "TalendProperties:ByteArray": {
      "@_xmi:id": generateTalendId(),
    }
  };

  const doc = {
    "xmi:XMI": root,
  };

  return { xml: buildXml(doc), rootId };
}

export function buildJobletPropertiesXml(spec: JobletSpec, rootItemId: string): string {
  const version = spec.version ?? "0.1";
  const itemFileName = `${spec.jobletName}_${version}.item`;
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
        "@_label": spec.label ?? spec.jobletName,
        "@_version": version,
        "@_displayName": spec.label ?? spec.jobletName,
        "@_purpose": spec.purpose ?? "",
        "@_description": spec.description ?? "",
        "@_item": itemId,
      },
      "TalendProperties:ItemState": {
        "@_xmi:id": stateId,
        "@_path": spec.folderPath ?? "",
      },
      "TalendProperties:JobletProcessItem": {
        "@_xmi:id": itemId,
        "@_property": propId,
        "@_state": stateId,
        jobletProcess: { "@_href": `${itemFileName}#${rootItemId}` },
        icon: { "@_href": `${itemFileName}#${generateTalendId()}` },
      },
    },
  };

  return buildXml(doc);
}
