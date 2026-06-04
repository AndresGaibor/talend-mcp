import type { SchemaIssue } from "../../domain/job/job.entity";

export class FixPlannerUseCase {
  async execute(issues: SchemaIssue[]): Promise<FixRecommendation[]> {
    const recomendaciones: FixRecommendation[] = [];

    for (const issue of issues) {
      const recomendacion = this.generarRecomendacion(issue);
      if (recomendacion) {
        recomendaciones.push(recomendacion);
      }
    }

    return recomendaciones;
  }

  private generarRecomendacion(issue: SchemaIssue): FixRecommendation | null {
    switch (issue.issue) {
      case "empty-column-name":
        return {
          component: issue.component,
          issue: "Columna sin nombre en schema",
          fix: `Agregar nombre descriptivo a la columna en ${issue.schema ?? "schema desconocido"} del componente ${issue.component}`,
          risk: "medium",
        };
      case "null-column-name":
        return {
          component: issue.component,
          issue: "Columna con nombre 'null'",
          fix: `Renombrar columna 'null' en ${issue.schema ?? "schema"} del componente ${issue.component} a un nombre válido`,
          risk: "high",
        };
      default:
        return null;
    }
  }
}

export interface FixRecommendation {
  component: string;
  issue: string;
  fix: string;
  risk: "low" | "medium" | "high";
}