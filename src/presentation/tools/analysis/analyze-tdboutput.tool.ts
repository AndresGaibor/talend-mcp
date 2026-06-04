import { JobXmlRepository } from "../../../infrastructure/repositories/job-xml.repository";
import type { TdbOutputAnalysis } from "../../../domain/analysis/analysis.entity";
import type { ParsedJob } from "../../../domain/job/job.entity";
import { ok, fail } from "../common/response";

function analyzeTdbOutputs(job: ParsedJob): TdbOutputAnalysis[] {
  return [];
}

export function createAnalyzeTdbOutputTool() {
  const jobRepo = new JobXmlRepository();

  return {
    name: "analyze_tdboutput",
    description: "Analiza los componentes tDBOutput (tMysqlOutput, tDBOutput) de un job para mostrar configuración de base de datos.",
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
        const tdbOutputs: TdbOutputAnalysis[] = analyzeTdbOutputs(job).map((o) => ({
          componentName: o.componentName,
          uniqueName: o.uniqueName,
          host: o.host,
          port: o.port,
          dbName: o.dbName,
          user: o.user,
          table: o.table,
          tableAction: o.tableAction,
          dataAction: o.dataAction,
          batchSize: o.batchSize,
          schema: o.schema,
        }));
        return ok({ tdbOutputs, count: tdbOutputs.length }, { startTime: start });
      } catch (err) {
        return fail("ANALYZE_TDBOUTPUT_ERROR", `Error analizando tDBOutput: ${err}`, { startTime: start });
      }
    },
  };
}