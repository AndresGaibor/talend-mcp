import { z } from "zod/v4";
import { renameTalendJob } from "../../../talend/job-crud";
import { ok, fail } from "../common/response";

const RenameJobSchema = z.object({
  oldJobName: z.string().describe("Nombre actual del job"),
  newJobName: z.string().describe("Nuevo nombre del job"),
  folderPath: z.string().optional().describe("Carpeta del job origen"),
});

export function createRenameJobTool() {
  return {
    name: "talend_rename_job",
    description: "Renombra un job existente.",
    inputSchema: RenameJobSchema,
    handler: async (input: z.infer<typeof RenameJobSchema>) => {
      try {
        const projectPath = process.env.TALEND_PROJECT;
        if (!projectPath) return fail("NO_PROJECT", "No se detectó TALEND_PROJECT.");
        const result = await renameTalendJob(projectPath, {
          oldJobName: input.oldJobName,
          newJobName: input.newJobName,
          folderPath: input.folderPath,
        });
        return ok({
          oldItemPath: result.oldItemPath,
          oldPropertiesPath: result.oldPropertiesPath,
          newItemPath: result.newItemPath,
          newPropertiesPath: result.newPropertiesPath,
          newJobName: input.newJobName
        });
      } catch (err) {
        if (String(err).includes("no encontrado")) {
          return fail("JOB_NOT_FOUND", `Job no encontrado: ${input.oldJobName}`);
        }
        if (String(err).includes("ambiguo")) {
          return fail("JOB_AMBIGUOUS", `Job ambiguo: ${input.oldJobName}`);
        }
        return fail("RENAME_JOB_ERROR", `Error renombrando job: ${err}`);
      }
    },
  };
}