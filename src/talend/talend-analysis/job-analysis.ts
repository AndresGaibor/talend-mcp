import type { ParsedJob } from "../types";
import { analyzeTdbOutputs, findSchemaIssues, analyzeColumns, summarizeColumnIssues } from "../analysis";
import { inspectTalendJob } from "../inspection";
import type { FullJobAnalysis, JobIssue } from "./types";

/** Problemas de schema, conexiones rotas y contextos sin nombre. */
function collectIssues(job: ParsedJob, schemaIssues: ReturnType<typeof findSchemaIssues>): JobIssue[] {
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

  return issues;
}

/** Resumen en una linea con los conteos de problemas. */
function buildSummary(critical: number, warnings: number): string {
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
  return summary;
}

/** Numero total de columnas declaradas en los schemas del job. */
function countTotalColumns(job: ParsedJob): number {
  let totalColumns = 0;
  for (const comp of job.components) {
    for (const schema of comp.schemas) {
      totalColumns += schema.columns.length;
    }
  }
  return totalColumns;
}

export function analyzeJob(job: ParsedJob): FullJobAnalysis {
  const inspection = inspectTalendJob(job);
  const tdbOutputs = analyzeTdbOutputs(job);
  const schemaIssues = findSchemaIssues(job);
  const columnAnalysis = analyzeColumns(job);
  const columnSummary = summarizeColumnIssues(columnAnalysis);

  const issues = collectIssues(job, schemaIssues);

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

  const totalColumns = countTotalColumns(job);

  const critical = issues.filter((i) => i.severity === "critical").length + columnSummary.critical;
  const warnings = issues.filter((i) => i.severity === "warning").length + columnSummary.warnings;

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
    summary: buildSummary(critical, warnings),
  };
}
