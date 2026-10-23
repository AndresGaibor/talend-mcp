import { z } from "zod/v4";
import { basename } from "node:path";
import { JobXmlRepository } from "../../../infrastructure/repositories/job-xml.repository";
import { resolveProjectPath } from "../../../talend/workspace";
import { ok, fail } from "../common/response";

const ReadContextsSchema = z.object({
  jobName: z.string().describe("Nombre del job"),
  folderPath: z.string().optional().describe("Carpeta del job"),
});

export function createReadContextsTool() {
  return {
    name: "talend_read_contexts",
    description: "Lee los contextos y parámetros de un job.",
    inputSchema: ReadContextsSchema,
    handler: async (input: z.infer<typeof ReadContextsSchema>) => {
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
          contexts: parsed.contexts,
          count: parsed.contexts.length,
        });
      } catch (err) {
        return fail("READ_CONTEXTS_ERROR", `Error leyendo contextos: ${err}`);
      }
    },
  };
}