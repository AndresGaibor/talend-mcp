import { readTextFile } from "../../../infrastructure/filesystem/file-reader";
import { parseXml, asArray } from "../../../infrastructure/xml/xml-utils";
import { ok, fail } from "../common/response";
import type { DqAnalysis, DQIndicator } from "../../../infrastructure/repositories/dq-xml.repository";

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

export function createReadAnalysisTool() {
  return {
    name: "read_analysis",
    description: "Lee y retorna el contenido de un análisis DQ específico.",
    inputSchema: {
      type: "object",
      properties: {
        analysisPath: { type: "string", description: "Ruta completa al archivo .ana del análisis" },
      },
      required: ["analysisPath"],
    },
    handler: async (input: { analysisPath: string }) => {
      const start = Date.now();
      try {
        const content = await readTextFile(input.analysisPath);
        const parsed = parseXml(content) as XmlRecord;
        const analysis = parseDQAnalysisFromXml(parsed, input.analysisPath);
        if (!analysis) {
          return fail("PARSE_ERROR", "No se pudo parsear el análisis DQ", { startTime: start });
        }
        return ok({ analysis }, { startTime: start });
      } catch (err) {
        return fail("READ_ANALYSIS_ERROR", `Error leyendo análisis DQ: ${err}`, { startTime: start });
      }
    },
  };
}