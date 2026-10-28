import { buildXml } from "../xml";
import { generateTalendId } from "../utils";
import { buildComponentNode, buildConnectionNode, withMapperMetanames } from "./component-node";
import type { JobletSpec } from "./types";

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

  const connections = withMapperMetanames(spec.components, spec.connections ?? []);
  const nodes = spec.components.map((c) => buildComponentNode(c, connections));
  const nodeSection = nodes.length === 1 ? nodes[0] : nodes;

  let connectionSection: unknown = [];
  if (spec.connections && spec.connections.length > 0) {
    const connNodes = connections.map((c) => buildConnectionNode(c));
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
