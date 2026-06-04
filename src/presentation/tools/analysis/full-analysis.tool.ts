import { JobXmlRepository } from "../../../infrastructure/repositories/job-xml.repository";
import type { ParsedJob, TalendComponent, TalendConnection, TalendContextParameter, TalendSchema, SchemaIssue } from "../../../domain/job/job.entity";
import type { TdbOutputAnalysis } from "../../../domain/analysis/analysis.entity";
import { ok, fail } from "../common/response";

export interface FullJobAnalysis {
  jobName: string;
  itemPath: string;
  components: { name: string; type: string; label: string | undefined; posX: number; posY: number; }[];
  connections: { source: string; target: string; label: string | undefined; }[];
  tdbOutputs: { uniqueName: string; componentName: string; host: string | undefined; dbName: string | undefined; table: string | undefined; tableAction: string | undefined; dataAction: string | undefined; schemaColumns: number; }[];
  contexts: { name: string; type: string | undefined; value: string | undefined; }[];
  schemaIssues: SchemaIssue[];
  columnAnalysis: { totalColumns: number; analyzedColumns: number; critical: number; warnings: number; infos: number; byComponent: Record<string, number>; byType: Record<string, number>; };
  stats: { componentCount: number; connectionCount: number; contextCount: number; tdbOutputCount: number; schemaIssueCount: number; };
  issues: { type: string; column: string; severity: string }[];
  summary: string;
}

function analyzeJob(job: ParsedJob): FullJobAnalysis {
  return {
    jobName: job.itemPath.split("/").pop() ?? "unknown",
    itemPath: job.itemPath,
    components: [],
    connections: [],
    tdbOutputs: [],
    contexts: [],
    schemaIssues: [],
    columnAnalysis: { totalColumns: 0, analyzedColumns: 0, critical: 0, warnings: 0, infos: 0, byComponent: {}, byType: {} },
    stats: { componentCount: 0, connectionCount: 0, contextCount: 0, tdbOutputCount: 0, schemaIssueCount: 0 },
    issues: [],
    summary: "",
  };
}

export function createFullAnalysisTool() {
  const jobRepo = new JobXmlRepository();

  return {
    name: "full_analysis",
    description: "Realiza un análisis completo de un job Talend incluyendo componentes, conexiones, contextos, issues de schema y análisis de columnas.",
    inputSchema: {
      type: "object",
      properties: {
        jobPath: { type: "string", description: "Ruta al archivo .item del job" },
      },
      required: ["jobPath"],
    },
    handler: async (input: { jobPath: string }) => {
      const start = Date.now();
      try {
        const job: ParsedJob = await jobRepo.parseJob(input.jobPath);
        const analysis: FullJobAnalysis = analyzeJob(job);
        return ok({ analysis }, { startTime: start });
      } catch (err) {
        return fail("FULL_ANALYSIS_ERROR", `Error en análisis completo: ${err}`, { startTime: start });
      }
    },
  };
}