import { z } from "zod/v4";
import { createTalendJob } from "../../../talend/job-crud";
import { ok, fail } from "../common/response";

const CreateJobSchema = z.object({
  jobName: z.string().describe("Nombre del job"),
  version: z.string().optional().describe("Versión (default: 0.1)"),
  defaultContext: z.string().optional().describe("Contexto por defecto (default: Default)"),
  label: z.string().optional().describe("Etiqueta visible"),
  folderPath: z.string().optional().describe("Carpeta destino dentro de process"),
  description: z.string().optional().describe("Descripción inicial"),
  purpose: z.string().optional().describe("Propósito inicial"),
});

export function createCreateJobTool() {
  return {
    name: "talend_create_job",
    description: "Crea un job nuevo vacío en el proyecto.",
    inputSchema: CreateJobSchema,
    handler: async (input: z.infer<typeof CreateJobSchema>) => {
      try {
        const projectPath = process.env.TALEND_PROJECT;
        if (!projectPath) return fail("NO_PROJECT", "No se detectó TALEND_PROJECT.");
        const result = await createTalendJob(projectPath, {
          jobName: input.jobName,
          version: input.version ?? "0.1",
          defaultContext: input.defaultContext,
          label: input.label,
          folderPath: input.folderPath,
          description: input.description,
          purpose: input.purpose,
        });
        return ok({
          itemPath: result.itemPath,
          propertiesPath: result.propertiesPath,
          jobName: input.jobName,
          version: input.version ?? "0.1"
        });
      } catch (err) {
        return fail("CREATE_JOB_ERROR", `Error creando job: ${err}`);
      }
    },
  };
}