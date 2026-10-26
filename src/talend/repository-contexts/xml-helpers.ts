import { join } from "node:path";
import { asArray, parseXml } from "../xml";
import type { TalendContextParameter } from "../types";
import type { RepositoryContextContext } from "./types";

export type XmlRecord = Record<string, unknown>;

export function attr(nodo: XmlRecord | undefined, nombre: string): string | undefined {
  const valor = nodo?.[`@_${nombre}`];
  return typeof valor === "string" ? valor : undefined;
}

export function contextDir(projectPath: string): string {
  return join(projectPath, "context");
}

export function resolveContextFiles(projectPath: string, contextName: string): { itemPath: string; propertiesPath: string } {
  const dir = contextDir(projectPath);
  const itemPath = join(dir, `${contextName}_0.1.item`);
  const propertiesPath = join(dir, `${contextName}_0.1.properties`);
  return { itemPath, propertiesPath };
}

function parseItemParameters(context: XmlRecord): TalendContextParameter[] {
  return asArray(context.contextParameter as XmlRecord | XmlRecord[] | undefined).map((parameter) => ({
    name: attr(parameter, "name") ?? "",
    type: attr(parameter, "type"),
    value: attr(parameter, "value"),
    prompt: attr(parameter, "prompt"),
  }));
}

export function parseItemContexts(xml: string): RepositoryContextContext[] {
  const parsed = parseXml(xml) as Record<string, XmlRecord>;
  const root = parsed["talendfile:ContextType"] ?? parsed.ContextType;
  if (!root) return [];

  const contexts: RepositoryContextContext[] = [];

  if (root.context !== undefined) {
    asArray(root.context as XmlRecord | XmlRecord[] | undefined).forEach((context) => {
      contexts.push({
        contextName: attr(context, "name") ?? "",
        parameters: parseItemParameters(context),
      });
    });
  } else {
    contexts.push({
      contextName: attr(root, "name") ?? "",
      parameters: parseItemParameters(root),
    });
  }

  return contexts;
}

export function parseProperties(parsed: XmlRecord): { label: string; version: string; purpose?: string; description?: string } {
  const xmi = (parsed["xmi:XMI"] ?? parsed["xmi_XMI"] ?? parsed) as XmlRecord;
  const propRaw = xmi["TalendProperties:Property"] ?? xmi["TalendProperties_Property"];
  const property = (typeof propRaw === "object" ? propRaw : {}) as XmlRecord;

  let purpose = attr(property, "purpose");
  let description = attr(property, "description");

  const additionalProps = asArray(property.additionalProperties as XmlRecord | XmlRecord[] | undefined);
  for (const ap of additionalProps) {
    const key = attr(ap, "key");
    const value = attr(ap, "value");
    if (key === "purpose" && !purpose) purpose = value;
    if (key === "description" && !description) description = value;
  }

  return {
    label: attr(property, "label") ?? "",
    version: attr(property, "version") ?? "0.1",
    purpose,
    description,
  };
}
