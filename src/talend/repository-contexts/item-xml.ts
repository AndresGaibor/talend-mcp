import { asArray, buildXml, parseXml } from "../xml";
import { generateTalendId } from "../utils";
import { attr, type XmlRecord } from "./xml-helpers";

function resolveTargetParameters(
  root: XmlRecord,
  options: { contextName: string },
): XmlRecord[] {
  if (root.context !== undefined) {
    const contexts = asArray(root.context as XmlRecord | XmlRecord[] | undefined);
    const context = contexts.find((item) => attr(item, "name") === options.contextName);
    if (!context) throw new Error(`Contexto no encontrado: ${options.contextName}`);
    return asArray(context.contextParameter as XmlRecord | XmlRecord[] | undefined);
  }

  const rootContextName = attr(root, "name");
  if (rootContextName !== options.contextName) {
    throw new Error(`Contexto no encontrado: ${options.contextName}`);
  }
  return asArray(root.contextParameter as XmlRecord | XmlRecord[] | undefined);
}

export function updateItemXmlParameter(
  xml: string,
  options: { contextName: string; parameterName: string; value: string; type?: string; prompt?: string },
  mode: "update" | "upsert",
): string {
  const document = parseXml(xml) as Record<string, XmlRecord>;
  const root = document["talendfile:ContextType"] ?? document.ContextType;
  if (!root) throw new Error("XML de contexto Talend inválido");

  const targetParams = resolveTargetParameters(root, options);

  const target = targetParams.find((p) => attr(p, "name") === options.parameterName);

  if (target) {
    target["@_value"] = options.value;
    if (options.type !== undefined) target["@_type"] = options.type;
    if (options.prompt !== undefined) target["@_prompt"] = options.prompt;
  } else if (mode === "upsert") {
    const newParam: XmlRecord = {
      "@_xmi:id": generateTalendId(),
      "@_name": options.parameterName,
      "@_value": options.value,
    };
    if (options.type !== undefined) newParam["@_type"] = options.type;
    if (options.prompt !== undefined) newParam["@_prompt"] = options.prompt;
    targetParams.push(newParam);
  } else {
    throw new Error(`Parámetro no encontrado: ${options.parameterName}`);
  }

  root.contextParameter = targetParams.length === 1 ? targetParams[0] : targetParams;

  return buildXml(document);
}

export function deleteItemXmlParameter(xml: string, options: { contextName: string; parameterName: string }): string {
  const document = parseXml(xml) as Record<string, XmlRecord>;
  const root = document["talendfile:ContextType"] ?? document.ContextType;
  if (!root) throw new Error("XML de contexto Talend inválido");

  const targetParams = resolveTargetParameters(root, options);

  const filtered = targetParams.filter((p) => attr(p, "name") !== options.parameterName);
  if (filtered.length === targetParams.length) throw new Error(`Parámetro no encontrado: ${options.parameterName}`);

  root.contextParameter = filtered.length === 1 ? filtered[0] : filtered;
  return buildXml(document);
}
