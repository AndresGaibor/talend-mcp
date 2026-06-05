import { z } from "zod/v4";
import { JobXmlRepository } from "../../../infrastructure/repositories/job-xml.repository";
import { okResult, errorResult } from "../common/result";

const ReadJobSchema = z.object({
  jobName: z.string().describe("Nombre del job a leer"),
  folderPath: z.string().optional().describe("Carpeta del job"),
});

export function createReadJobTool() {
  return {
    name: "talend_jobs_read",
    description: "Lee y retorna el contenido XML de un job Talend.",
    inputSchema: ReadJobSchema,
    handler: async (input: z.infer<typeof ReadJobSchema>) => {
      try {
        const projectPath = process.env.TALEND_PROJECT;
        if (!projectPath) return errorResult("read-job", "NO_PROJECT", "No se detectó TALEND_PROJECT.");
        const repo = new JobXmlRepository();
        const jobs = await repo.listJobs(projectPath);
        const jobPath = jobs.find((j: string) => {
          const nameFromPath = j.split("/").pop()?.replace(/_\d+\.\d+\.item$/, "") ?? "";
          return nameFromPath === input.jobName;
        });
        if (!jobPath) return errorResult("read-job", "JOB_NOT_FOUND", `Job no encontrado: ${input.jobName}`);
        const xml = await repo.findJob(jobPath);
        return okResult({ jobName: input.jobName, itemPath: jobPath, xml }, "read-job");
      } catch (err) {
        return errorResult("read-job", "READ_JOB_ERROR", `Error leyendo job: ${err}`);
      }
    },
  };
}