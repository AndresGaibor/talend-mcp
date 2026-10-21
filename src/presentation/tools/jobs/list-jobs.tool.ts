import { statSync } from "node:fs";
import { TalendJobRepository } from "../../../modules/jobs/adapters/talend-job.repository";
import { okResult, errorResult } from "../common/result";

/**
 * Lista los jobs del proyecto.
 *
 * Se leen del proyecto (los `.item` y sus `.properties`), asi que no hace
 * falta que Talend Studio este abierto.
 */
export function createListJobsTool() {
  const repository = new TalendJobRepository();

  return {
    name: "talend_jobs_list",
    description:
      "Lista todos los jobs en un proyecto Talend: nombre, version, carpeta, fecha de modificacion y numero de componentes.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: {
          type: "string",
          description: "Ruta del proyecto Talend (opcional, se obtiene del entorno si no se provee)",
        },
        limit: { type: "number", description: "Máximo de jobs a devolver", default: 50 },
        offset: { type: "number", description: "Cantidad de jobs a omitir", default: 0 },
      },
    },
    handler: async (input: { projectPath?: string; limit?: number; offset?: number }) => {
      try {
        const limit = input.limit ?? 50;
        const offset = input.offset ?? 0;
        const todos = await repository.list({ path: input.projectPath });
        const jobs = todos.slice(offset, offset + limit).map((job) => ({
          name: job.name,
          version: job.version,
          path: job.path,
          folder: job.path.replace(/\\/g, "/").split("/process/")[1]?.split("/")[0] ?? "",
          modified: job.modifiedAt.toISOString(),
          size: sizeOf(job.path),
          components: job.components.length,
        }));

        return okResult({ jobs, count: jobs.length, total: todos.length }, "list-jobs");
      } catch (err) {
        return errorResult("list-jobs", "LIST_JOBS_ERROR", `Error listando jobs: ${err}`);
      }
    },
  };
}

/** El tamano del archivo del job, en bytes. */
function sizeOf(path: string): number {
  try {
    return statSync(path).size;
  } catch {
    return 0;
  }
}
