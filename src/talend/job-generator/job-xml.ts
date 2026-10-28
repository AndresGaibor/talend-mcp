import { buildXml } from "../xml";
import { createEmptyJobItemXml } from "../job-crud/create";
import { generateTalendId } from "../utils";
import { buildComponentNode, buildConnectionNode } from "./component-node";
import type { JobSpec } from "./types";

export function buildJobItemXml(spec: JobSpec): { xml: string; rootId: string } {
  const version = spec.version ?? "0.1";
  const defaultContext = spec.defaultContext ?? "Default";
  const rootId = generateTalendId();

  // Un job sin componentes y sin variables de contexto es un job vacio. Con variables (una libreria de macros SAS
  // solo aporta contexto) se escriben igual: antes se descartaban en silencio.
  if (spec.components.length === 0 && !spec.contexts?.length) {
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
    "@_xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
    "@_xmlns:TalendMapper": "http://www.talend.org/mapper",
    "@_xmlns:talendfile": "platform:/resource/org.talend.model/model/TalendFile.xsd",
    "@_xmi:id": rootId,
    "@_defaultContext": defaultContext,
    "@_jobType": "Standard",
  };

  Object.assign(root, contextSection);
  if (nodes.length > 0) root.node = nodeSection;
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
  // El ProcessItem referencia a la propiedad por su `xmi:id`, no por su atributo `id`.
  const propXmiId = generateTalendId();
  const itemId = generateTalendId();
  const stateId = generateTalendId();

  const doc = {
    "xmi:XMI": {
      "@_xmi:version": "2.0",
      "@_xmlns:xmi": "http://www.omg.org/XMI",
      "@_xmlns:TalendProperties": "http://www.talend.org/properties",
      "TalendProperties:Property": {
        "@_xmi:id": propXmiId,
        "@_id": propId,
        "@_label": spec.label ?? spec.jobName,
        "@_version": version,
        "@_statusCode": "",
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
        "@_property": propXmiId,
        "@_state": stateId,
        // Como Studio: la raiz del .item es `#/`. Con el id de la raiz Studio no resuelve la referencia al borrar el
        // job y deja el .item huerfano en disco.
        process: { "@_href": `${itemFileName}#/` },
      },
    },
  };

  return buildXml(doc);
}
