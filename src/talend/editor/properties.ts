import { buildXml, parseXml } from "../xml";
import { diffText } from "./xml-base";
import type { EditResult, JobPropertiesEditOptions, XmlRecord } from "./types";

/** Metadatos del job en el `.properties`. */

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

export function buildTalendJobPropertiesEditPreview(xml: string, options: JobPropertiesEditOptions): EditResult {
  const before = xml;
  const after = updateTalendJobPropertiesXml(xml, options);

  return {
    xml: after,
    changed: before !== after,
    diff: diffText(before, after),
  };
}
