import type { AnalyzeJobUseCase } from "../../../application/jobs/analyze-job.usecase";
import { ok, fail } from "../common/response";

export function createAnalyzeJobTool(analyzeJobUseCase: AnalyzeJobUseCase) {
  return {
    name: "analyze_talend_job",
    description: "Analiza un job Talend y retorna información sobre componentes, conexiones, contextos y problemas.",
    inputSchema: {
      type: "object",
      properties: {
        jobPath: { type: "string" },
      },
      required: ["jobPath"],
    },
    handler: async (input: { jobPath: string }) => {
      const start = Date.now();
      try {
        const result = await analyzeJobUseCase.execute(input.jobPath);
        return ok({ analysis: result }, { startTime: start });
      } catch (err) {
        return fail("ANALYSIS_ERROR", `Error analizando job: ${err}`, { startTime: start });
      }
    },
  };
}