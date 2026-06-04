import { listDqAnalyses } from "../../../infrastructure/repositories/dq-xml.repository";
import { ok, fail } from "../common/response";

export function createListAnalysesTool() {
  return {
    name: "list_analyses",
    description: "Lista todos los análisis DQ (Data Profiling) en un proyecto Talend.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: { type: "string", description: "Ruta del proyecto Talend" },
      },
      required: ["projectPath"],
    },
    handler: async (input: { projectPath: string }) => {
      const start = Date.now();
      try {
        const analyses = await listDqAnalyses(input.projectPath);
        return ok({ analyses, count: analyses.length }, { startTime: start });
      } catch (err) {
        return fail("LIST_ANALYSES_ERROR", `Error listando análisis DQ: ${err}`, { startTime: start });
      }
    },
  };
}