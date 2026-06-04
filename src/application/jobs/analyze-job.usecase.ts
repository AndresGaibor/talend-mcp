import type { IJobRepository, JobSpec } from "../../domain/job/job.repository";
import type { FullJobAnalysis } from "../../domain/analysis/analysis.entity";
import { DomainError } from "../../domain/common/errors";

export class AnalyzeJobUseCase {
  constructor(private jobRepo: IJobRepository) {}

  async execute(jobPath: string): Promise<FullJobAnalysis> {
    if (!jobPath) {
      throw new DomainError("Ruta de job es requerida");
    }

    const jobContent = await this.jobRepo.findJob(jobPath);
    const parsedJob = await this.jobRepo.parseJob(jobPath);

    const issues = this.detectarIssues(parsedJob.components);
    const tdbOutputs = this.extraerTdbOutputs(parsedJob.components);
    const schemaIssues = this.detectarSchemaIssues(parsedJob.components);

    return {
      jobName: this.extraerJobName(jobPath),
      issues,
      tdbOutputs,
      schemaIssues,
      stats: this.calcularStats(parsedJob),
    };
  }

  private detectarIssues(components: import("../../domain/job/job.entity").TalendComponent[]) {
    const issues: import("../../domain/analysis/analysis.entity").ColumnIssue[] = [];
    const columnasVistas = new Map<string, string>();

    for (const comp of components) {
      for (const schema of comp.schemas) {
        for (const columna of schema.columns) {
          if (!columna.name || columna.name.trim() === "") {
            issues.push({ type: "empty-name" });
          } else if (columna.name.toLowerCase() === "null") {
            issues.push({ type: "null-name", column: columna.name });
          } else {
            const key = `${comp.uniqueName}:${columna.name}`;
            if (columnasVistas.has(key)) {
              issues.push({ type: "duplicate-column", column: columna.name });
            } else {
              columnasVistas.set(key, comp.uniqueName);
            }
          }
        }
      }
    }
    return issues;
  }

  private extraerTdbOutputs(components: import("../../domain/job/job.entity").TalendComponent[]) {
    const tdbOutputs: import("../../domain/analysis/analysis.entity").TdbOutputAnalysis[] = [];

    for (const comp of components) {
      const name = comp.componentName.toLowerCase();
      if (name.includes("tdboutput") || name.includes("tdmapoutput")) {
        tdbOutputs.push({
          componentName: comp.componentName,
          uniqueName: comp.uniqueName,
          host: comp.parameters["HOST"],
          port: comp.parameters["PORT"],
          dbName: comp.parameters["DBNAME"],
          user: comp.parameters["USER"],
          table: comp.parameters["TABLE"],
          tableAction: comp.parameters["TABLEACTION"],
          dataAction: comp.parameters["DATAACTION"],
          batchSize: comp.parameters["BATCHSIZE"],
          schema: comp.schemas[0],
        });
      }
    }
    return tdbOutputs;
  }

  private detectarSchemaIssues(components: import("../../domain/job/job.entity").TalendComponent[]) {
    const schemaIssues: import("../../domain/job/job.entity").SchemaIssue[] = [];

    for (const comp of components) {
      for (const schema of comp.schemas) {
        for (const columna of schema.columns) {
          if (!columna.name || columna.name.trim() === "") {
            schemaIssues.push({
              component: comp.uniqueName,
              schema: schema.name,
              issue: "empty-column-name",
            });
          } else if (columna.name.toLowerCase() === "null") {
            schemaIssues.push({
              component: comp.uniqueName,
              schema: schema.name,
              column: columna.name,
              issue: "null-column-name",
            });
          }
        }
      }
    }
    return schemaIssues;
  }

  private calcularStats(parsedJob: import("../../domain/job/job.repository").ParsedJob) {
    const totalComponents = parsedJob.components.length;
    const tMapCount = parsedJob.components.filter(c =>
      c.componentName.toLowerCase().includes("tmap")
    ).length;
    const inputCount = parsedJob.components.filter(c =>
      c.componentName.toLowerCase().startsWith("tinput") ||
      c.componentName.toLowerCase().includes("input")
    ).length;
    const outputCount = parsedJob.components.filter(c =>
      c.componentName.toLowerCase().startsWith("toutput") ||
      c.componentName.toLowerCase().includes("output")
    ).length;
    const totalSchemaColumns = parsedJob.components.reduce(
      (sum, c) => sum + c.schemas.reduce((s, sc) => s + sc.columns.length, 0),
      0
    );

    return {
      totalComponents,
      tMapCount,
      inputCount,
      outputCount,
      totalSchemaColumns,
    };
  }

  private extraerJobName(jobPath: string): string {
    const parts = jobPath.split("/");
    const fileName = parts[parts.length - 1] ?? "";
    return fileName.replace(".item", "");
  }
}