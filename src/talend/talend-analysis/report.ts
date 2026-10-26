import type { FullJobAnalysis } from "./types";

export function formatAnalysis(analysis: FullJobAnalysis): string {
  let out = "";
  out += `=== ANÁLISIS DE JOB: ${analysis.jobName} ===\n\n`;

  out += `📊 ESTADÍSTICAS:\n`;
  out += `  Componentes: ${analysis.stats.componentCount}\n`;
  out += `  Conexiones: ${analysis.stats.connectionCount}\n`;
  out += `  Contextos: ${analysis.stats.contextCount}\n`;
  out += `  tDBOutput: ${analysis.stats.tdbOutputCount}\n`;
  out += `  Schema issues: ${analysis.stats.schemaIssueCount}\n\n`;

  out += `📝 RESUMEN: ${analysis.summary}\n\n`;

  if (analysis.schemaIssues.length > 0) {
    out += `🔴 PROBLEMAS CRÍTICOS (${analysis.schemaIssues.length}):\n`;
    for (const si of analysis.schemaIssues) {
      out += `  - [${si.component}] Column "${si.column}" en schema "${si.schema ?? "N/A"}": ${si.issue}\n`;
    }
    out += "\n";
  }

  if (analysis.tdbOutputs.length > 0) {
    out += `🗄️ BASES DE DATOS:\n`;
    for (const tdb of analysis.tdbOutputs) {
      out += `  - ${tdb.uniqueName} (${tdb.componentName})\n`;
      out += `    Host: ${tdb.host ?? "N/A"} | DB: ${tdb.dbName ?? "N/A"}\n`;
      out += `    Tabla: ${tdb.table ?? "N/A"} | Action: ${tdb.tableAction}/${tdb.dataAction}\n`;
      out += `    Columnas schema: ${tdb.schemaColumns}\n`;
    }
    out += "\n";
  }

  if (analysis.issues.filter((i) => i.severity === "warning").length > 0) {
    out += `⚡ WARNINGS (${analysis.issues.filter((i) => i.severity === "warning").length}):\n`;
    for (const w of analysis.issues.filter((i) => i.severity === "warning")) {
      out += `  - [${w.category}] ${w.message}\n`;
    }
    out += "\n";
  }

  out += `🔌 FLUJO:\n`;
  for (const c of analysis.connections) {
    out += `  ${c.source} → ${c.target}${c.label ? ` (${c.label})` : ""}\n`;
  }
  out += "\n";

  if (analysis.contexts.length > 0) {
    out += `📋 CONTEXTOS:\n`;
    for (const ctx of analysis.contexts.slice(0, 10)) {
      out += `  ${ctx.name} = ${ctx.value ?? "(sin valor)"} [${ctx.type ?? "N/A"}]\n`;
    }
    if (analysis.contexts.length > 10) {
      out += `  ... y ${analysis.contexts.length - 10} más\n`;
    }
  }

  const ca = analysis.columnAnalysis;
  if (ca.analyzedColumns > 0) {
    out += `\n📐 ANÁLISIS DE COLUMNAS:\n`;
    out += `  Total columnas: ${ca.totalColumns} | Analizadas con issues: ${ca.analyzedColumns}\n`;
    out += `  🔴 critical: ${ca.critical} | ⚡ warnings: ${ca.warnings} | ℹ️ infos: ${ca.infos}\n`;
    if (Object.keys(ca.byType).length > 0) {
      out += `  Por tipo: ${Object.entries(ca.byType).map(([k, v]) => `${k}=${v}`).join(", ")}\n`;
    }
  }

  return out;
}
