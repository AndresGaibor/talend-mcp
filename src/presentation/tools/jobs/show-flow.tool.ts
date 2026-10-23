import { z } from "zod/v4";
import { basename } from "node:path";
import { JobXmlRepository } from "../../../infrastructure/repositories/job-xml.repository";
import { resolveProjectPath } from "../../../talend/workspace";
import { ok, fail } from "../common/response";

const ShowFlowSchema = z.object({
  jobName: z.string().describe("Nombre del job"),
  folderPath: z.string().optional().describe("Carpeta del job"),
});

export function createShowFlowTool() {
  return {
    name: "talend_show_flow",
    description: "Muestra el flujo de datos (conexiones) de un job.",
    inputSchema: ShowFlowSchema,
    handler: async (input: z.infer<typeof ShowFlowSchema>) => {
      try {
        const projectPath = await resolveProjectPath();
        if (!projectPath) return fail("NO_PROJECT", "No se detectó el proyecto de Talend: abre un proyecto en Studio o define TALEND_PROJECT.");
        const repo = new JobXmlRepository();
        const jobs = await repo.listJobs(projectPath);
        const jobPath = jobs.find((j: string) => {
          const nameFromPath = basename(j).replace(/_\d+\.\d+\.item$/, "");
          return nameFromPath === input.jobName;
        });
        if (!jobPath) return fail("JOB_NOT_FOUND", `Job no encontrado: ${input.jobName}`);
        const parsed = await repo.parseJob(jobPath);
        return ok({
          jobName: input.jobName,
          connections: parsed.connections,
          count: parsed.connections.length,
        });
      } catch (err) {
        return fail("SHOW_FLOW_ERROR", `Error mostrando flujo: ${err}`);
      }
    },
  };
}