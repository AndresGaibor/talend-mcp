import { join } from "node:path";
import { existsSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { parseXml, asArray, buildXml } from "../xml/xml-utils";

export interface DQIndicator {
  name: string;
  type: string;
  computed: boolean;
  count?: number;
  length?: number;
  distinctValueCount?: number;
  valueToFreq?: string;
  analyzedElement: string;
}

export interface DqAnalysis {
  name: string;
  status: string;
  purpose: string;
  description: string;
  version: string;
  author: string;
  defaultContext: string;
  lastRunOk: boolean;
  lastRunDate?: string;
  lastRunDuration?: number;
  connectionName: string;
  connectionPath: string;
  columnCount: number;
  analyzedColumns: string[];
  indicators: DQIndicator[];
  filePath: string;
}

export type DqAnalysisMetadataUpdate = Partial<Pick<DqAnalysis, "name" | "status" | "purpose" | "description" | "version" | "author" | "defaultContext">>;

type XmlRecord = Record<string, unknown>;

function attr(nodo: XmlRecord | undefined, nombre: string): string | undefined {
  const valor = nodo?.[`@_${nombre}`];
  return typeof valor === "string" ? valor : undefined;
}

function boolAttr(nodo: XmlRecord, nombre: string): boolean {
  const val = nodo[`@_${nombre}`];
  return val === "true" || val === true;
}

function safeBoolAttr(nodo: XmlRecord | undefined, nombre: string): boolean {
  return nodo ? boolAttr(nodo, nombre) : false;
}

function numAttr(nodo: XmlRecord, nombre: string): number | undefined {
  const val = nodo[`@_${nombre}`];
  if (val == null) return undefined;
  const n = Number(val);
  return isNaN(n) ? undefined : n;
}

function safeNumAttr(nodo: XmlRecord | undefined, nombre: string): number | undefined {
  return nodo ? numAttr(nodo, nombre) : undefined;
}

function extractIndicatorName(indicator: XmlRecord): string {
  const builtIn = indicator["builtInIndicatorDefinition"] as XmlRecord | undefined;
  const name = attr(builtIn, "name") ?? attr(builtIn, "label");
  if (name) return name;
  if (indicator["lowerValue"] || indicator["upperValue"]) return "Range";
  return "unknown";
}

function extractIndicatorType(indicator: XmlRecord): string {
  return attr(indicator, "xsi:type") ?? "unknown";
}

function fileNameFromHref(href: string): string {
  const base = href.split("#")[0] ?? href;
  return base.split("/").pop()?.replace(".item", "") ?? "unknown";
}

function parseDQAnalysisFromXml(parsed: XmlRecord, anaPath: string): DqAnalysis | null {
  const root = parsed["xmi:XMI"] as XmlRecord | undefined;
  if (!root) return null;

  const analysis = asArray(root["dataquality.analysis:Analysis"] as XmlRecord | XmlRecord[])[0] as XmlRecord | undefined;
  if (!analysis) return null;

  const taggedValues = asArray(analysis["taggedValue"] as XmlRecord | XmlRecord[]);
  const tv = (tag: string): string => {
    const found = taggedValues.find((t) => attr(t as XmlRecord, "tag") === tag) as XmlRecord | undefined;
    return attr(found, "value") ?? "";
  };

  const context = asArray(analysis["context"] as XmlRecord | XmlRecord[])[0] as XmlRecord | undefined;
  const connectionNode = context ? asArray(context["connection"] as XmlRecord | XmlRecord[])[0] as XmlRecord | undefined : undefined;
  const connection = attr(connectionNode, "href") ?? "";
  const analysedElements: XmlRecord[] = context ? asArray(context["analysedElements"] as XmlRecord | XmlRecord[]) : [];

  const results = asArray(analysis["results"] as XmlRecord | XmlRecord[])[0] as XmlRecord | undefined;
  const resultMetadata = results ? asArray(results["resultMetadata"] as XmlRecord | XmlRecord[])[0] as XmlRecord | undefined : undefined;
  const indicatorsXml = results ? asArray(results["indicators"] as XmlRecord | XmlRecord[]) : [];

  const indicators: DQIndicator[] = [];
  for (const ind of indicatorsXml) {
    const indType = extractIndicatorType(ind);
    const analyzedEl = ind["analyzedElement"] as XmlRecord | undefined;
    const analyzedHref = attr(analyzedEl, "href") ?? "";

    indicators.push({
      name: extractIndicatorName(ind),
      type: indType.replace("dataquality.indicators:", ""),
      computed: boolAttr(ind, "computed"),
      count: numAttr(ind, "count"),
      length: numAttr(ind, "length"),
      distinctValueCount: numAttr(ind, "distinctValueCount"),
      valueToFreq: attr(ind, "valueToFreq"),
      analyzedElement: analyzedHref.split("#").pop() ?? analyzedHref,
    });
  }

  const connectionName = fileNameFromHref(connection);

  return {
    name: attr(analysis, "name") ?? "unknown",
    status: tv("Status"),
    purpose: tv("Purpose"),
    description: tv("Description"),
    version: tv("Version") || "0.1",
    author: tv("Author"),
    defaultContext: attr(analysis, "defaultContext") ?? "Default",
    lastRunOk: safeBoolAttr(resultMetadata, "lastRunOk"),
    lastRunDate: attr(resultMetadata, "executionDate"),
    lastRunDuration: safeNumAttr(resultMetadata, "executionDuration"),
    connectionName,
    connectionPath: connection,
    columnCount: analysedElements.length,
    analyzedColumns: analysedElements.map((el) => attr(el, "href")?.split("#").pop() ?? "unknown"),
    indicators,
    filePath: anaPath,
  };
}

function updateDQAnalysisXmlInternal(xml: string, updates: DqAnalysisMetadataUpdate): string {
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

function updateDQAnalysisPropertiesXmlInternal(xml: string, updates: DqAnalysisMetadataUpdate & { fileName?: string }): string {
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

export async function listDqAnalyses(projectPath: string): Promise<DqAnalysis[]> {
  const analysesDir = join(projectPath, "TDQ_Data Profiling", "Analyses");
  if (!existsSync(analysesDir)) return [];

  const files = readdirSync(analysesDir).filter((f) => f.endsWith(".ana") && !f.endsWith(".properties"));
  const analyses: DqAnalysis[] = [];

  for (const file of files) {
    try {
      const content = readFileSync(join(analysesDir, file), "utf-8");
      const parsed = parseXml(content) as XmlRecord;
      const analysis = parseDQAnalysisFromXml(parsed, join(analysesDir, file));
      if (analysis) analyses.push(analysis);
    } catch {
      continue;
    }
  }

  return analyses;
}

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

export async function duplicateDqAnalysis(analysisPath: string, newName: string): Promise<{ anaPath: string; propertiesPath: string }> {
  const anaPath = analysisPath.endsWith(".ana") ? analysisPath : `${analysisPath}.ana`;
  const propsPath = anaPath.replace(/\.ana$/, ".properties");

  if (!existsSync(anaPath)) throw new Error(`Archivo .ana no encontrado: ${anaPath}`);

  const content = readFileSync(anaPath, "utf-8");
  const parsed = parseXml(content) as XmlRecord;
  const analysis = parseDQAnalysisFromXml(parsed, anaPath);
  if (!analysis) throw new Error("No se pudo leer el análisis fuente");

  const dir = join(anaPath, "..").replace(/[/\\][^/\\]+$/, "");
  const version = analysis.version || "0.1";
  const newBase = `${newName}_${version}`;
  const newAnaPath = join(dir, `${newBase}.ana`);
  const newPropsPath = join(dir, `${newBase}.properties`);

  const updatedAna = updateDQAnalysisXmlInternal(content, { name: newName, version });
  const propsContent = readFileSync(propsPath, "utf8");
  const updatedProps = updateDQAnalysisPropertiesXmlInternal(propsContent, {
    name: newName,
    version,
    fileName: `${newBase}.ana`,
  });

  writeFileSync(newAnaPath, updatedAna);
  writeFileSync(newPropsPath, updatedProps);

  return { anaPath: newAnaPath, propertiesPath: newPropsPath };
}