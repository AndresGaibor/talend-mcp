import type { ParsedJob, SchemaIssue, TdbOutputAnalysis } from "./types";

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