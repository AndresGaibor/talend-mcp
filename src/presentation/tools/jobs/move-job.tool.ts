import { z } from "zod/v4";
import { moveTalendJobToFolder } from "../../../talend/job-crud";
import { ok, fail } from "../common/response";

const MoveJobSchema = z.object({
  jobName: z.string().describe("Nombre del job a mover"),
  folderPath: z.string().describe("Carpeta destino dentro de process"),
});

export function createMoveJobTool() {
  return {
    name: "talend_move_job_to_folder",
    description: "Mueve un job existente a otra carpeta dentro de process.",
    inputSchema: MoveJobSchema,
    handler: async (input: z.infer<typeof MoveJobSchema>) => {
      try {
        const projectPath = process.env.TALEND_PROJECT;
        if (!projectPath) return fail("NO_PROJECT", "No se detectó TALEND_PROJECT.");
        const result = await moveTalendJobToFolder(projectPath, {
          jobName: input.jobName,
          folderPath: input.folderPath,
        });
        return ok({
          oldItemPath: result.oldItemPath,
          oldPropertiesPath: result.oldPropertiesPath,
          newItemPath: result.newItemPath,
          newPropertiesPath: result.newPropertiesPath,
          folderPath: input.folderPath,
        });
      } catch (err) {
        if (String(err).includes("no encontrado")) {
          return fail("JOB_NOT_FOUND", `Job no encontrado: ${input.jobName}`);
        }
        if (String(err).includes("ambiguo")) {
          return fail("JOB_AMBIGUOUS", `Job ambiguo: ${input.jobName}`);
        }
        return fail("MOVE_JOB_ERROR", `Error moviendo job: ${err}`);
      }
    },
  };
}