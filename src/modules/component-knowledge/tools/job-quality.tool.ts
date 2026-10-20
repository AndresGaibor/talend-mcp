import { z } from "zod/v4";
import type { CallToolResult } from "@modelcontextprotocol/server";

export const JobQualitySchema = z.object({
  jobId: z.string().optional().describe("Nombre del job. Si se omite, se intenta detectar el job activo."),
});

export type JobQualityInput = z.infer<typeof JobQualitySchema>;

export type QualitySeverity = "critical" | "high" | "medium" | "low";

export type QualityIssue = {
  id: string;
  title: string;
  description: string;
  severity: QualitySeverity;
  fixSolution?: string;
  componentName?: string;
};

export type QualityReport = {
  jobId: string;
  score: number;
  issues: QualityIssue[];
  lastUpdated: string;
};

const SEVERITY_WEIGHT: Record<QualitySeverity, number> = {
  critical: 25,
  high: 15,
  medium: 8,
  low: 3,
};

function buildIssues(report: {
  jobName: string;
  components: { total: number; missingUniqueNames: string[] };
  connections: { total: number; danglingConnections: Array<{ uniqueName?: string; source?: string; target?: string; reason: string }> };
  contexts: { total: number; names: string[]; possibleMissingValues: string[] };
  schemas: { total: number; warnings: string[] };
  logs: { latestStatus?: "success" | "error" | "unknown"; latestError?: string };
}): QualityIssue[] {
  const issues: QualityIssue[] = [];

  for (const name of report.components.missingUniqueNames) {
    issues.push({
      id: `missing-unique-name:${name}`,
      title: `Componente sin uniqueName: ${name}`,
      description: `El componente '${name}' no tiene uniqueName, por lo que no puede conectarse de forma fiable.`,
      severity: "high",
      componentName: name,
      fixSolution: "Asigna un uniqueName único al componente.",
    });
  }

  for (const dangling of report.connections.danglingConnections) {
    issues.push({
      id: `dangling-connection:${dangling.uniqueName ?? dangling.source ?? "?"}`,
      title: "Conexión colgante",
      description: dangling.reason,
      severity: "critical",
      componentName: dangling.uniqueName,
      fixSolution: "Elimina la conexión o crea el componente que falta.",
    });
  }

  for (const context of report.contexts.possibleMissingValues) {
    issues.push({
      id: `missing-context-value:${context}`,
      title: `Contexto '${context}' sin valor`,
      description: `El contexto '${context}' está declarado pero no tiene valor por defecto.`,
      severity: "medium",
      componentName: context,
      fixSolution: `Define un valor por defecto para '${context}' o documenta que es obligatorio.`,
    });
  }

  for (const warning of report.schemas.warnings) {
    issues.push({
      id: `schema-warning:${warning}`,
      title: "Problema en el schema",
      description: warning,
      severity: "medium",
      fixSolution: "Revisa las columnas del schema del componente.",
    });
  }

  if (report.logs.latestStatus === "error") {
    issues.push({
      id: "last-run-failed",
      title: "La última ejecución falló",
      description: report.logs.latestError ?? "El log de la última ejecución registra un error.",
      severity: "critical",
      fixSolution: "Revisa el log de ejecución y corrige la causa del error.",
    });
  }

  return issues;
}

function computeScore(issues: QualityIssue[]): number {
  const penalty = issues.reduce((total, issue) => total + SEVERITY_WEIGHT[issue.severity], 0);
  return Math.max(0, 100 - penalty);
}

async function collectIssues(jobId?: string): Promise<{ ok: true; report: QualityReport } | { ok: false; error: string }> {
  const { diagnoseJob } = await import("../../../talend/diagnostics/job-diagnostics");

  const diagnosis = await diagnoseJob(jobId);
  if (!diagnosis.ok || !diagnosis.data) {
    return { ok: false, error: diagnosis.error ?? "No se pudo diagnosticar el job." };
  }

  const issues = buildIssues(diagnosis.data);

  return {
    ok: true,
    report: {
      jobId: diagnosis.data.jobName,
      score: computeScore(issues),
      issues,
      lastUpdated: new Date().toISOString(),
    },
  };
}

export function createJobQualityReportTool() {
  return {
    name: "talend_job_quality_report",
    description:
      "Genera un reporte de calidad de un job Talend con puntaje, severidad y soluciones sugeridas. Solo lectura.",
    inputSchema: JobQualitySchema,
    annotations: {
      readOnly: true,
    },
    handler: async (input: JobQualityInput): Promise<CallToolResult> => {
      try {
        const outcome = await collectIssues(input.jobId);

        if (!outcome.ok) {
          return {
            content: [{ type: "text", text: outcome.error }],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: "text",
              text: `Job '${outcome.report.jobId}': puntaje ${outcome.report.score}/100 con ${outcome.report.issues.length} hallazgo(s).`,
            },
          ],
          structuredContent: { report: outcome.report } as any,
          isError: false,
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error generando el reporte de calidad: ${err}` }],
          isError: true,
        };
      }
    },
  };
}

export function createJobQualityIssuesTool() {
  return {
    name: "talend_job_quality_issues",
    description:
      "Lista los hallazgos de calidad de un job Talend con severidad y solución sugerida. Solo lectura.",
    inputSchema: JobQualitySchema,
    annotations: {
      readOnly: true,
    },
    handler: async (input: JobQualityInput): Promise<CallToolResult> => {
      try {
        const outcome = await collectIssues(input.jobId);

        if (!outcome.ok) {
          return {
            content: [{ type: "text", text: outcome.error }],
            isError: true,
          };
        }

        return {
          content: [
            { type: "text", text: `${outcome.report.issues.length} hallazgo(s) para '${outcome.report.jobId}'.` },
          ],
          structuredContent: { issues: outcome.report.issues } as any,
          isError: false,
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error listando los hallazgos de calidad: ${err}` }],
          isError: true,
        };
      }
    },
  };
}
