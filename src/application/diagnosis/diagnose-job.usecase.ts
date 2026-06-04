import type { IJobRepository } from "../../domain/job/job.repository";
import type { TalendComponent, SchemaIssue } from "../../domain/job/job.entity";

export class DiagnoseJobUseCase {
  constructor(private jobRepo: IJobRepository) {}

  async execute(jobPath: string): Promise<JobDiagnosisResult> {
    const warnings: string[] = [];
    const parsedJob = await this.jobRepo.parseJob(jobPath);

    const components = parsedJob.components;
    const schemaIssues = this.detectarSchemaIssues(components);
    const missingUniqueNames = this.detectarFaltantes(components);
    const danglingConnections = this.detectarConexionesColgantes(
      parsedJob.connections,
      components
    );

    if (missingUniqueNames.length > 0) {
      warnings.push(
        `${missingUniqueNames.length} componente(s) sin uniqueName: ${missingUniqueNames.join(", ")}`
      );
    }
    if (danglingConnections.length > 0) {
      warnings.push(`${danglingConnections.length} conexión(es) colgante(s)`);
    }
    if (schemaIssues.length > 0) {
      warnings.push(`${schemaIssues.length} issue(s) de schema detectados`);
    }

    const contextSinValor = parsedJob.contexts.filter(
      (c) => !c.value || c.value.trim() === ""
    );
    if (contextSinValor.length > 0) {
      warnings.push(
        `${contextSinValor.length} contexto(s) sin valor: ${contextSinValor.map((c) => c.name).join(", ")}`
      );
    }

    return {
      jobPath,
      components,
      schemaIssues,
      stats: {
        componentCount: components.length,
        connectionCount: parsedJob.connections.length,
        contextCount: parsedJob.contexts.length,
      },
      warnings,
    };
  }

  private detectarSchemaIssues(components: TalendComponent[]): SchemaIssue[] {
    const issues: SchemaIssue[] = [];
    for (const comp of components) {
      for (const schema of comp.schemas) {
        for (const col of schema.columns) {
          if (!col.name || col.name.trim() === "") {
            issues.push({
              component: comp.uniqueName,
              schema: schema.name,
              issue: "empty-column-name",
            });
          } else if (col.name.toLowerCase() === "null") {
            issues.push({
              component: comp.uniqueName,
              schema: schema.name,
              column: col.name,
              issue: "null-column-name",
            });
          }
        }
      }
    }
    return issues;
  }

  private detectarFaltantes(components: TalendComponent[]): string[] {
    const faltantes: string[] = [];
    for (const comp of components) {
      if (!comp.uniqueName || comp.uniqueName.trim() === "") {
        faltantes.push(comp.componentName);
      }
    }
    return faltantes;
  }

  private detectarConexionesColgantes(
    connections: { source?: string; target?: string; uniqueName?: string }[],
    components: TalendComponent[]
  ): { uniqueName?: string; source?: string; target?: string }[] {
    const componentNames = new Set(components.map((c) => c.uniqueName));
    const colgantes: { uniqueName?: string; source?: string; target?: string }[] = [];
    for (const conn of connections) {
      if (conn.source && !componentNames.has(conn.source)) {
        colgantes.push({ uniqueName: conn.uniqueName, source: conn.source, target: conn.target });
      }
      if (conn.target && !componentNames.has(conn.target)) {
        colgantes.push({ uniqueName: conn.uniqueName, source: conn.source, target: conn.target });
      }
    }
    return colgantes;
  }
}

export interface JobDiagnosisResult {
  jobPath: string;
  components: TalendComponent[];
  schemaIssues: SchemaIssue[];
  stats: {
    componentCount: number;
    connectionCount: number;
    contextCount: number;
  };
  warnings: string[];
}