import type { DQAnalysis, DQIndicator } from "./types";

/** Formatea el detalle de un análisis DQ. */
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

/** Formatea el listado resumido de análisis DQ. */
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

/** Formatea el detalle de varios análisis DQ. */
export function formatDQAnalysesDetails(analyses: DQAnalysis[]): string {
  if (analyses.length === 0) return "No hay análisis DQ en este proyecto.";

  return analyses.map((analysis) => formatDQAnalysis(analysis)).join("\n---\n");
}
