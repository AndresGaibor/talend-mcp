import { z } from "zod/v4";
import { TalendJobRepository } from "../../../modules/jobs/adapters/talend-job.repository";
import { okResult, errorResult } from "../common/result";

const ReadJobSchema = z.object({
  jobName: z.string().describe("Nombre del job a leer"),
  folderPath: z.string().optional().describe("Carpeta del job"),
});

/**
 * Lee un job del proyecto.
 *
 * Se leen del proyecto (los `.item` y sus `.properties`), asi que no hace
 * falta que Talend Studio este abierto. Devuelve el job con sus componentes y
 * sus conexiones, y el XML del `.item`.
 */
export function createReadJobTool() {
  const repository = new TalendJobRepository();

  return {
    name: "talend_jobs_read",
    description:
      "Lee un job de Talend: sus componentes, sus conexiones y el XML del .item. Se lee del proyecto, sin necesidad de que Studio este abierto.",
    inputSchema: ReadJobSchema,
    handler: async (input: z.infer<typeof ReadJobSchema>) => {
      try {
        const job = await repository.findByName(input.jobName, input.folderPath);
        if (!job) {
          return errorResult("read-job", "JOB_NOT_FOUND", `Job no encontrado: ${input.jobName}`);
        }
        return okResult(
          {
            jobName: job.name,
            version: job.version,
            itemPath: job.path,
            propertiesPath: job.path.replace(/\.item$/, ".properties"),
            description: job.description,
            modified: job.modifiedAt.toISOString(),
            components: job.components.map((component) => ({
              id: component.id,
              name: component.name,
              type: component.type,
              position: component.position,
              parameters: component.configuration,
            })),
            connections: job.connections,
          },
          "read-job",
        );
      } catch (err) {
        return errorResult("read-job", "READ_JOB_ERROR", `Error leyendo job: ${err}`);
      }
    },
  };
}
