import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { asArray, parseXml } from "./xml";

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

export interface DQAnalysis {
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

export function listDQAnalyses(projectPath: string): DQAnalysis[] {
  const analysesDir = join(projectPath, "TDQ_Data Profiling", "Analyses");
  if (!existsSync(analysesDir)) return [];

  const files = readdirSync(analysesDir).filter((f) => f.endsWith(".ana") && !f.endsWith(".properties"));
  const analyses: DQAnalysis[] = [];

  for (const file of files) {
    const ana = parseDQAnalysis(join(analysesDir, file));
    if (ana) analyses.push(ana);
  }

  return analyses;
}

export function formatDQAnalysis(analysis: DQAnalysis): string {
  let out = "";
  out += `📊 ${analysis.name} (${analysis.version})\n`;
  out += `   Estado: ${analysis.status} | Autor: ${analysis.author}\n`;
  out += `   Fuente: ${analysis.connectionName} | Columnas: ${analysis.columnCount}\n`;
  out += `   Propósito: ${analysis.purpose || "(sin descripción)"}\n`;

  if (analysis.lastRunOk) {
    out += `   ✅ Última ejecución: ${analysis.lastRunDate ?? "unknown"} (${analysis.lastRunDuration ?? 0}ms)\n`;
  } else {
    out += `   ❌ Sin ejecución exitosa o no ha sido ejecutado\n`;
  }

  if (analysis.indicators.length > 0) {
    const byColumn = new Map<string, DQIndicator[]>();
    for (const ind of analysis.indicators) {
      const col = ind.analyzedElement;
      if (!byColumn.has(col)) byColumn.set(col, []);
      byColumn.get(col)!.push(ind);
    }

    out += `\n   📐 INDICADORES POR COLUMNA:\n`;
    for (const [col, inds] of byColumn) {
      out += `   ─ ${col}\n`;
      for (const ind of inds) {
        const status = ind.computed ? "✅" : "⏳";
        const value = ind.count !== undefined ? `count=${ind.count}` :
          ind.length !== undefined ? `length=${ind.length}` :
            ind.distinctValueCount !== undefined ? `distinct=${ind.distinctValueCount}` : "";
        out += `     ${status} ${ind.name} [${ind.type}] ${value}\n`;
      }
    }
  }

  return out;
}

export function formatDQAnalysesList(analyses: DQAnalysis[]): string {
  if (analyses.length === 0) return "No hay análisis DQ en este proyecto.";

  let out = `📊 ANÁLISIS DISPONIBLES (${analyses.length}):\n\n`;
  for (const a of analyses) {
    out += `📌 ${a.name} (${a.version})\n`;
    out += `   Fuente: ${a.connectionName} | Columnas: ${a.columnCount}\n`;
    out += `   Status: ${a.status}\n`;
    out += `   ${a.lastRunOk ? "✅ Última ejecución OK" : "❌ Sin ejecución exitosa"}\n`;
    out += `   Indicadores configurados: ${a.indicators.length}\n\n`;
  }

  return out;
}

export function formatDQAnalysesDetails(analyses: DQAnalysis[]): string {
  if (analyses.length === 0) return "No hay análisis DQ en este proyecto.";

  return analyses.map((analysis) => formatDQAnalysis(analysis)).join("\n---\n");
}
