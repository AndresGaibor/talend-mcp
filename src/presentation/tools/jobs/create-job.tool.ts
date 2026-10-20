import { z } from "zod/v4";
import { createTalendJob } from "../../../talend/job-crud";
import { resolveProjectPath } from "../../../talend/workspace";
import { okResult, errorResult } from "../common/result";

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
    name: "talend_jobs_create",
    description: "Crea un job nuevo vacío en el proyecto.",
    inputSchema: CreateJobSchema,
    handler: async (input: z.infer<typeof CreateJobSchema>) => {
      try {
        const projectPath = await resolveProjectPath();
        if (!projectPath) return errorResult("create-job", "NO_PROJECT", "No se pudo detectar el proyecto Talend.");
        const result = await createTalendJob(projectPath, {
          jobName: input.jobName,
          version: input.version ?? "0.1",
          defaultContext: input.defaultContext,
          label: input.label,
          folderPath: input.folderPath,
          description: input.description,
          purpose: input.purpose,
        });
        return okResult({
          itemPath: result.itemPath,
          propertiesPath: result.propertiesPath,
          jobName: input.jobName,
          version: input.version ?? "0.1"
        }, "create-job");
      } catch (err) {
        return errorResult("create-job", "CREATE_JOB_ERROR", `Error creando job: ${err}`);
      }
    },
  };
}