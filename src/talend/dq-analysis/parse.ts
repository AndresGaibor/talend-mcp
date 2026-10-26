import { existsSync, readFileSync } from "node:fs";
import { asArray, parseXml } from "../xml";
import { elementNameFromHref } from "../../infrastructure/xml/xml-utils";
import {
  attr,
  boolAttr,
  extractIndicatorName,
  extractIndicatorType,
  numAttr,
  safeBoolAttr,
  safeNumAttr,
} from "./attrs";
import type { DQAnalysis, DQIndicator, XmlRecord } from "./types";

function fileNameFromHref(href: string): string {
  return elementNameFromHref(href);
}

/** Lee un `.ana` de Talend y devuelve su análisis, o `null` si no se puede. */
export function parseDQAnalysis(anaPath: string): DQAnalysis | null {
  if (!existsSync(anaPath)) return null;

  try {
    const content = readFileSync(anaPath, "utf-8");
    const parsed = parseXml(content) as XmlRecord;
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
    const analysedElements: XmlRecord[] = context
      ? asArray(context["analysedElements"] as XmlRecord | XmlRecord[])
      : [];

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
  } catch {
    return null;
  }
}
