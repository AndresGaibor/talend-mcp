import { z } from "zod/v4";
import { duplicateTalendJob } from "../../../talend/job-crud";
import { ok, fail } from "../common/response";

const DuplicateJobSchema = z.object({
  sourceJobName: z.string().describe("Nombre del job origen"),
  sourceFolderPath: z.string().optional().describe("Carpeta del job origen"),
  targetJobName: z.string().describe("Nombre del job duplicado"),
  targetVersion: z.string().optional().describe("Versión del duplicado"),
  targetFolderPath: z.string().optional().describe("Carpeta destino del duplicado"),
});

export function createDuplicateJobTool() {
  return {
    name: "talend_duplicate_job",
    description: "Duplica un job existente con un nombre nuevo.",
    inputSchema: DuplicateJobSchema,
    handler: async (input: z.infer<typeof DuplicateJobSchema>) => {
      try {
        const projectPath = process.env.TALEND_PROJECT;
        if (!projectPath) return fail("NO_PROJECT", "No se detectó TALEND_PROJECT.");
        const result = await duplicateTalendJob(projectPath, {
          sourceJobName: input.sourceJobName,
          sourceFolderPath: input.sourceFolderPath,
          targetJobName: input.targetJobName,
          targetVersion: input.targetVersion,
          targetFolderPath: input.targetFolderPath,
        });
        return ok({
          newItemPath: result.itemPath,
          newPropertiesPath: result.propertiesPath,
          sourceJobName: input.sourceJobName,
          targetJobName: input.targetJobName,
        });
      } catch (err) {
        if (String(err).includes("no encontrado")) {
          return fail("JOB_NOT_FOUND", `Job origen no encontrado: ${input.sourceJobName}`);
        }
        if (String(err).includes("ambiguo")) {
          return fail("JOB_AMBIGUOUS", `Job ambiguo: ${input.sourceJobName}`);
        }
        return fail("DUPLICATE_JOB_ERROR", `Error duplicando job: ${err}`);
      }
    },
  };
}