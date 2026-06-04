import { z } from "zod/v4";
import { rmSync } from "node:fs";
import { deleteTalendJob, findTalendJob } from "../../../talend/job-crud";
import { ok, fail } from "../common/response";

const DeleteJobSchema = z.object({
  jobName: z.string().describe("Nombre del job a eliminar"),
  folderPath: z.string().optional().describe("Carpeta del job"),
});

export function createDeleteJobTool() {
  return {
    name: "talend_delete_job",
    description: "Elimina un job existente (item + properties).",
    inputSchema: DeleteJobSchema,
    handler: async (input: z.infer<typeof DeleteJobSchema>) => {
      try {
        const projectPath = process.env.TALEND_PROJECT;
        if (!projectPath) return fail("NO_PROJECT", "No se detectó TALEND_PROJECT.");
        const job = await findTalendJob(projectPath, input.jobName, input.folderPath);
        rmSync(job.itemPath, { force: true });
        rmSync(job.propertiesPath, { force: true });
        return ok({ deletedJob: input.jobName, itemPath: job.itemPath, propertiesPath: job.propertiesPath });
      } catch (err) {
        if (String(err).includes("no encontrado")) {
          return fail("JOB_NOT_FOUND", `Job no encontrado: ${input.jobName}`);
        }
        if (String(err).includes("ambiguo")) {
          return fail("JOB_AMBIGUOUS", `Job ambiguo: ${input.jobName}`);
        }
        return fail("DELETE_JOB_ERROR", `Error eliminando job: ${err}`);
      }
    },
  };
}