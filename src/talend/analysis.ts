import type { ParsedJob, SchemaIssue, TdbOutputAnalysis } from "./types";

const RESERVED_KEYWORDS = new Set([
  "select", "insert", "update", "delete", "drop", "create", "alter", "truncate",
  "from", "where", "group", "order", "having", "join", "union", "limit",
  "index", "table", "database", "schema", "key", "value", "null", "true", "false",
]);

function isReservedKeyword(name: string): boolean {
  return RESERVED_KEYWORDS.has(name.toLowerCase());
}

export interface ColumnAnalysis {
  uniqueName: string;
  componentName: string;
  schemaName: string;
  columnName: string;
  columnType: string | undefined;
  columnLength: number | undefined;
  nullable: boolean | undefined;
  issues: ColumnIssue[];
}

export type ColumnIssue =
  | { type: "empty-name"; severity: "critical" }
  | { type: "null-name"; severity: "critical" }
  | { type: "reserved-keyword"; severity: "warning"; keyword: string }
  | { type: "duplicate-name"; severity: "warning"; duplicates: string[] }
  | { type: "excessive-length"; severity: "info"; length: number; maxRecommended: number }
  | { type: "missing-type"; severity: "warning" }
  | { type: "name-with-spaces"; severity: "info" };

export function analyzeColumns(job: ParsedJob): ColumnAnalysis[] {
  const results: ColumnAnalysis[] = [];

  for (const component of job.components) {
    for (const schema of component.schemas) {
      const seen = new Map<string, number>();
      const nameCount = new Map<string, number>();

      for (const column of schema.columns) {
        const rawName = column.name.trim();
        if (!rawName) continue;

        nameCount.set(rawName, (nameCount.get(rawName) ?? 0) + 1);
      }

      for (const column of schema.columns) {
        const rawName = column.name.trim();
        if (!rawName) continue;

        const issues: ColumnIssue[] = [];

        if (rawName === "") {
          issues.push({ type: "empty-name", severity: "critical" });
        } else if (rawName.toLowerCase() === "null") {
          issues.push({ type: "null-name", severity: "critical" });
        } else {
          if (isReservedKeyword(rawName)) {
            issues.push({ type: "reserved-keyword", severity: "warning", keyword: rawName.toLowerCase() });
          }

          const count = nameCount.get(rawName) ?? 0;
          if (count > 1) {
            const dupes = [...nameCount.entries()]
              .filter(([name]) => name === rawName)
              .map(([name]) => name);
            issues.push({ type: "duplicate-name", severity: "warning", duplicates: dupes });
          }

          if (rawName.length > 64) {
            issues.push({ type: "excessive-length", severity: "info", length: rawName.length, maxRecommended: 64 });
          }

          if (rawName.includes(" ")) {
            issues.push({ type: "name-with-spaces", severity: "info" });
          }
        }

        if (!column.type || column.type === "") {
          issues.push({ type: "missing-type", severity: "warning" });
        }

        if (issues.length > 0 || schema.columns.length <= 5) {
          results.push({
            uniqueName: component.uniqueName,
            componentName: component.componentName,
            schemaName: schema.name ?? "(default)",
            columnName: rawName,
            columnType: column.type,
            columnLength: column.length,
            nullable: column.nullable,
            issues,
          });
        }
      }
    }
  }

  return results;
}

export function summarizeColumnIssues(analyses: ColumnAnalysis[]): {
  critical: number;
  warnings: number;
  infos: number;
  byComponent: Record<string, number>;
  byType: Record<string, number>;
} {
  let critical = 0;
  let warnings = 0;
  let infos = 0;
  const byComponent: Record<string, number> = {};
  const byType: Record<string, number> = {};

  for (const a of analyses) {
    if (a.issues.length === 0) continue;
    byComponent[a.uniqueName] = (byComponent[a.uniqueName] ?? 0) + a.issues.length;

    for (const issue of a.issues) {
      if (issue.severity === "critical") critical++;
      else if (issue.severity === "warning") warnings++;
      else infos++;

      byType[issue.type] = (byType[issue.type] ?? 0) + 1;
    }
  }

  return { critical, warnings, infos, byComponent, byType };
}

export function analyzeTdbOutputs(job: ParsedJob): TdbOutputAnalysis[] {
  return job.components
    .filter(
      (component) =>
        component.componentName === "tMysqlOutput" || component.componentName === "tDBOutput",
    )
    .map((component) => ({
      componentName: component.componentName,
      uniqueName: component.uniqueName,
      host: component.parameters.HOST,
      port: component.parameters.PORT,
      dbName: component.parameters.DBNAME,
      user: component.parameters.USER,
      table: component.parameters.TABLE,
      tableAction: component.parameters.TABLE_ACTION,
      dataAction: component.parameters.DATA_ACTION,
      batchSize: component.parameters.BATCH_SIZE,
      schema:
        component.schemas.find((schema) => schema.connector === "FLOW") ?? component.schemas[0],
    }));
}

export function findSchemaIssues(job: ParsedJob): SchemaIssue[] {
  const issues: SchemaIssue[] = [];

  for (const component of job.components) {
    for (const schema of component.schemas) {
      for (const column of schema.columns) {
        const name = column.name.trim();
        if (name === "") {
          issues.push({
            component: component.uniqueName,
            schema: schema.name,
            column: column.name,
            issue: "empty-column-name",
          });
        } else if (name.toLowerCase() === "null") {
          issues.push({
            component: component.uniqueName,
            schema: schema.name,
            column: column.name,
            issue: "null-column-name",
          });
        }
      }
    }
  }

  return issues;
}