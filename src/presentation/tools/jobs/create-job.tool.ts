import { z } from "zod/v4";
import { TalendJobRepository } from "../../../modules/jobs/adapters/talend-job.repository";
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

/**
 * Crea un job vacio en el proyecto.
 *
 * Se crea con la API de Studio, no escribiendo el `.item` a mano: asi el IDE
 * lo abre sin avisos y el repositorio no se queda con items fantasma.
 * Requiere que Talend Studio este abierto.
 */
export function createCreateJobTool() {
  const repository = new TalendJobRepository();

  return {
    name: "talend_jobs_create",
    description:
      "Crea un job nuevo vacío en el proyecto, con la API de Talend Studio (hace falta Studio abierto).",
    inputSchema: CreateJobSchema,
    handler: async (input: z.infer<typeof CreateJobSchema>) => {
      try {
        const job = await repository.create({
          name: input.label ?? input.jobName,
          path: input.folderPath ?? "",
          description: input.description ?? input.purpose,
        });
        return okResult(
          {
            itemPath: job.path,
            propertiesPath: job.path.replace(/\.item$/, ".properties"),
            jobName: job.name,
            version: job.version,
          },
          "create-job",
        );
      } catch (err) {
        return errorResult(
          "create-job",
          "CREATE_JOB_ERROR",
          `Error creando job: ${err}. Los jobs se crean con la API de Studio: abre Talend Studio.`,
        );
      }
    },
  };
}
