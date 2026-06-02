import type { ParsedJob } from "./types";
import { analyzeTdbOutputs, findSchemaIssues, analyzeColumns, summarizeColumnIssues, type ColumnAnalysis } from "./analysis";
import { inspectTalendJob, inspectTalendComponent } from "./inspection";

export type IssueSeverity = "critical" | "warning" | "info";

export type JobIssue =
  | { severity: "critical"; category: "schema"; component: string; message: string; detail?: string }
  | { severity: "warning"; category: "connection"; component: string; message: string; detail?: string }
  | { severity: "warning"; category: "context"; component: string; message: string; detail?: string }
  | { severity: "info"; category: "config"; component: string; message: string; detail?: string };

export interface FullJobAnalysis {
  jobName: string;
  itemPath: string;
  components: {
    name: string;
    type: string;
    label: string | undefined;
    posX: number;
    posY: number;
  }[];
  connections: {
    source: string;
    target: string;
    label: string | undefined;
  }[];
  tdbOutputs: {
    uniqueName: string;
    componentName: string;
    host: string | undefined;
    dbName: string | undefined;
    table: string | undefined;
    tableAction: string | undefined;
    dataAction: string | undefined;
    schemaColumns: number;
  }[];
  contexts: {
    name: string;
    type: string | undefined;
    value: string | undefined;
  }[];
  schemaIssues: {
    component: string;
    schema: string | undefined;
    column: string;
    issue: string;
    severity: "critical";
  }[];
  columnAnalysis: {
    totalColumns: number;
    analyzedColumns: number;
    critical: number;
    warnings: number;
    infos: number;
    byComponent: Record<string, number>;
    byType: Record<string, number>;
  };
  stats: {
    componentCount: number;
    connectionCount: number;
    contextCount: number;
    tdbOutputCount: number;
    schemaIssueCount: number;
  };
  issues: JobIssue[];
  summary: string;
}

export function analyzeJob(job: ParsedJob): FullJobAnalysis {
  const inspection = inspectTalendJob(job);
  const tdbOutputs = analyzeTdbOutputs(job);
  const schemaIssues = findSchemaIssues(job);
  const columnAnalysis = analyzeColumns(job);
  const columnSummary = summarizeColumnIssues(columnAnalysis);

  const issues: JobIssue[] = [];

  for (const si of schemaIssues) {
    issues.push({
      severity: "critical",
      category: "schema",
      component: si.component,
      message: `Columna inválida en schema "${si.schema}": "${si.column}"`,
      detail: si.issue === "empty-column-name" ? "Nombre de columna vacío" : "Columna se llama 'null'",
    });
  }

  for (const conn of job.connections) {
    const sourceExists = job.components.some((c) => c.uniqueName === conn.source);
    const targetExists = job.components.some((c) => c.uniqueName === conn.target);
    if (!sourceExists) {
      issues.push({
        severity: "warning",
        category: "connection",
        component: conn.uniqueName ?? conn.label ?? "unknown",
        message: `Conexión referencing source inexistente: "${conn.source}"`,
      });
    }
    if (!targetExists) {
      issues.push({
        severity: "warning",
        category: "connection",
        component: conn.uniqueName ?? conn.label ?? "unknown",
        message: `Conexión referencing target inexistente: "${conn.target}"`,
      });
    }
  }

  for (const ctx of job.contexts) {
    if (ctx.name.trim() === "") {
      issues.push({
        severity: "warning",
        category: "context",
        component: "context",
        message: "Parámetro de contexto con nombre vacío",
      });
    }
  }

  const components = inspection.components.map((c) => ({
    name: c.component.uniqueName,
    type: c.component.componentName,
    label: c.component.label,
    posX: parseInt(c.component.nodeAttributes.posX ?? "0", 10),
    posY: parseInt(c.component.nodeAttributes.posY ?? "0", 10),
  }));

  const connections = job.connections.map((c) => ({
    source: c.source,
    target: c.target,
    label: c.label,
  }));

  const contexts = job.contexts.map((c) => ({
    name: c.name,
    type: c.type,
    value: c.value,
  }));

  let totalColumns = 0;
  for (const comp of job.components) {
    for (const schema of comp.schemas) {
      totalColumns += schema.columns.length;
    }
  }

  const critical = issues.filter((i) => i.severity === "critical").length + columnSummary.critical;
  const warnings = issues.filter((i) => i.severity === "warning").length + columnSummary.warnings;

  let summary = "";
  if (critical > 0) {
    summary += `⚠️ ${critical} problema${critical > 1 ? "s" : ""} crítico${critical > 1 ? "s" : ""}. `;
  }
  if (warnings > 0) {
    summary += `⚡ ${warnings} warning${warnings > 1 ? "s" : ""}. `;
  }
  if (critical === 0 && warnings === 0) {
    summary = "✅ Job sin problemas detectados.";
  }

  return {
    jobName: job.components[0]?.parameters?.LABEL ?? inspection.job.components[0]?.label ?? "unknown",
    itemPath: job.itemPath,
    components,
    connections,
    tdbOutputs: tdbOutputs.map((o) => ({
      uniqueName: o.uniqueName,
      componentName: o.componentName,
      host: o.host,
      dbName: o.dbName,
      table: o.table,
      tableAction: o.tableAction,
      dataAction: o.dataAction,
      schemaColumns: o.schema?.columns.length ?? 0,
    })),
    contexts,
    schemaIssues: schemaIssues.map((si) => ({
      component: si.component,
      schema: si.schema,
      column: si.column ?? "(unknown)",
      issue: si.issue,
      severity: "critical" as const,
    })),
    columnAnalysis: {
      totalColumns,
      analyzedColumns: columnAnalysis.length,
      critical: columnSummary.critical,
      warnings: columnSummary.warnings,
      infos: columnSummary.infos,
      byComponent: columnSummary.byComponent,
      byType: columnSummary.byType,
    },
    stats: {
      componentCount: inspection.stats.componentCount,
      connectionCount: inspection.stats.connectionCount,
      contextCount: inspection.stats.contextCount,
      tdbOutputCount: tdbOutputs.length,
      schemaIssueCount: schemaIssues.length,
    },
    issues,
    summary,
  };
}

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