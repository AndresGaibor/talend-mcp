import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { asArray, buildXml, parseXml } from "../../xml/xml-utils";
import { attr } from "./xml-attrs";
import type { DqAnalysisMetadataUpdate, XmlRecord } from "./types";

export function updateDQAnalysisXmlInternal(xml: string, updates: DqAnalysisMetadataUpdate): string {
  const document = parseXml(xml) as Record<string, XmlRecord>;
  const root = document["xmi:XMI"] as XmlRecord | undefined;
  if (!root) throw new Error("XML de análisis DQ inválido");

  const analysis = asArray(root["dataquality.analysis:Analysis"] as XmlRecord | XmlRecord[])[0] as XmlRecord | undefined;
  if (!analysis) throw new Error("No se encontró el elemento Analysis");

  if (updates.name !== undefined) analysis["@_name"] = updates.name;

  let taggedValues = analysis["taggedValue"] as XmlRecord[] | undefined;
  if (!taggedValues) {
    taggedValues = [];
    analysis["taggedValue"] = taggedValues;
  }

  const tagMap = new Map(taggedValues.map((tv) => [attr(tv, "tag"), tv]));
  const fieldToTag: Record<string, string> = {
    status: "Status",
    purpose: "Purpose",
    description: "Description",
    version: "Version",
    author: "Author",
  };

  for (const [field, tag] of Object.entries(fieldToTag)) {
    if (updates[field as keyof DqAnalysisMetadataUpdate] !== undefined) {
      const existing = tagMap.get(tag);
      if (existing) {
        existing["@_value"] = updates[field as keyof DqAnalysisMetadataUpdate];
      } else {
        taggedValues.push({ "@_tag": tag, "@_value": updates[field as keyof DqAnalysisMetadataUpdate] } as XmlRecord);
      }
    }
  }

  if (updates.defaultContext !== undefined) {
    analysis["@_defaultContext"] = updates.defaultContext;
  }

  return buildXml(document);
}

export function updateDQAnalysisPropertiesXmlInternal(xml: string, updates: DqAnalysisMetadataUpdate & { fileName?: string }): string {
  const document = parseXml(xml) as Record<string, XmlRecord>;
  const root = document["xmi:XMI"] as XmlRecord | undefined;
  if (!root) throw new Error("XML de propiedades DQ inválido");

  const property = (root["TalendProperties:Property"] ?? root["TalendProperties_Property"]) as XmlRecord | undefined;
  if (!property) throw new Error("No se encontró TalendProperties:Property");

  if (updates.name !== undefined) {
    property["@_label"] = updates.name;
    property["@_displayName"] = updates.name;
  }
  if (updates.purpose !== undefined) property["@_purpose"] = updates.purpose;
  if (updates.description !== undefined) property["@_description"] = updates.description;
  if (updates.version !== undefined) property["@_version"] = updates.version;

  if (updates.fileName !== undefined) {
    const itemState = root["TalendProperties:ItemState"] ?? root["TalendProperties_ItemState"];
    if (itemState && typeof itemState === "object") {
      (itemState as XmlRecord)["@_path"] = updates.fileName.replace(/\.[^.]+$/, "");
    }
  }

  return buildXml(document);
}

/** Actualiza los metadatos de un análisis DQ en su `.ana` y su `.properties`. */
export async function updateDqAnalysis(analysisPath: string, updates: DqAnalysisMetadataUpdate): Promise<void> {
  const anaPath = analysisPath.endsWith(".ana") ? analysisPath : `${analysisPath}.ana`;
  const propsPath = anaPath.replace(/\.ana$/, ".properties");

  if (!existsSync(anaPath)) throw new Error(`Archivo .ana no encontrado: ${anaPath}`);
  if (!existsSync(propsPath)) throw new Error(`Archivo .properties no encontrado: ${propsPath}`);

  const anaXml = readFileSync(anaPath, "utf8");
  const propsXml = readFileSync(propsPath, "utf8");

  const updatedAna = updateDQAnalysisXmlInternal(anaXml, updates);
  const updatedProps = updateDQAnalysisPropertiesXmlInternal(propsXml, updates);

  writeFileSync(anaPath, updatedAna);
  writeFileSync(propsPath, updatedProps);
}
