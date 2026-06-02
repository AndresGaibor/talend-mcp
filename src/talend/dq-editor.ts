import { buildXml, parseXml, asArray } from "./xml";

type XmlRecord = Record<string, unknown>;

export type DQAnalysisMetadataEditOptions = {
  name?: string;
  status?: string;
  purpose?: string;
  description?: string;
  version?: string;
  author?: string;
  defaultContext?: string;
  fileName?: string;
};

function getRoot(document: Record<string, XmlRecord>): XmlRecord {
  const root = document["xmi:XMI"];
  if (!root) throw new Error("XML de analysis Talend inválido: falta xmi:XMI");
  return root;
}

function getAnalysis(root: XmlRecord): XmlRecord {
  const analysis = asArray(root["dataquality.analysis:Analysis"] as XmlRecord | XmlRecord[] | undefined)[0] as XmlRecord | undefined;
  if (!analysis) throw new Error("XML de analysis Talend inválido: falta dataquality.analysis:Analysis");
  return analysis;
}

function attr(nodo: XmlRecord | undefined, nombre: string): string | undefined {
  const valor = nodo?.[`@_${nombre}`];
  return typeof valor === "string" ? valor : undefined;
}

function setAttr(nodo: XmlRecord, nombre: string, valor: string | undefined): void {
  if (valor === undefined) return;
  nodo[`@_${nombre}`] = valor;
}

function upsertTaggedValue(analysis: XmlRecord, tag: string, value: string | undefined): void {
  if (value === undefined) return;

  const taggedValues = asArray(analysis.taggedValue as XmlRecord | XmlRecord[] | undefined);
  let target = taggedValues.find((item) => attr(item, "tag") === tag);

  if (!target) {
    target = { "@_tag": tag };
    taggedValues.push(target);
  }

  if (value === "") {
    delete target["@_value"];
  } else {
    target["@_value"] = value;
  }

  analysis.taggedValue = taggedValues.length === 1 ? taggedValues[0] : taggedValues;
}

export function updateDQAnalysisXml(xml: string, options: DQAnalysisMetadataEditOptions): string {
  const document = parseXml(xml) as Record<string, XmlRecord>;
  const root = getRoot(document);
  const analysis = getAnalysis(root);

  setAttr(analysis, "name", options.name);
  setAttr(analysis, "defaultContext", options.defaultContext);

  upsertTaggedValue(analysis, "Status", options.status);
  upsertTaggedValue(analysis, "Purpose", options.purpose);
  upsertTaggedValue(analysis, "Description", options.description);
  upsertTaggedValue(analysis, "Version", options.version);
  upsertTaggedValue(analysis, "Author", options.author);

  return buildXml(document);
}

export function updateDQAnalysisPropertiesXml(xml: string, options: DQAnalysisMetadataEditOptions): string {
  const document = parseXml(xml) as Record<string, XmlRecord>;
  const root = getRoot(document);
  const property = root["TalendProperties:Property"] as XmlRecord | undefined;
  const item = root["dataquality.properties:TDQAnalysisItem"] as XmlRecord | undefined;

  if (!property) throw new Error("XML de properties Talend inválido: falta TalendProperties:Property");
  if (!item) throw new Error("XML de properties Talend inválido: falta dataquality.properties:TDQAnalysisItem");

  setAttr(property, "label", options.name);
  setAttr(property, "displayName", options.name);
  setAttr(property, "purpose", options.purpose);
  setAttr(property, "version", options.version);
  setAttr(property, "statusCode", options.status);

  const analysis = item.analysis as XmlRecord | undefined;
  const currentHref = attr(analysis, "href");
  if (analysis && options.fileName) {
    const fragment = currentHref?.split("#")[1];
    analysis["@_href"] = fragment ? `${options.fileName}#${fragment}` : options.fileName;
    item.analysis = analysis;
  }

  return buildXml(document);
}
