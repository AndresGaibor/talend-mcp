import { z } from "zod/v4";
import { rmSync } from "node:fs";
import { deleteTalendJob, findTalendJob } from "../../../talend/job-crud";
import { resolveProjectPath } from "../../../talend/workspace";
import { createSnapshot } from "../../../talend/sync/snapshot-manager";
import { okResult, errorResult } from "../common/result";

const DeleteJobSchema = z.object({
  jobName: z.string().describe("Nombre del job a eliminar"),
  folderPath: z.string().optional().describe("Carpeta del job"),
  dryRun: z.boolean().optional().default(true).describe("Solo previsualizar, sin borrar (por defecto true)"),
  confirm: z.boolean().optional().describe("Confirmacion explicita para borrar (requerido con dryRun false)"),
});

export function createDeleteJobTool() {
  return {
    name: "talend_delete_job",
    description: "Elimina un job existente (item + properties) con snapshot recuperable. dryRun por defecto: previsualiza sin borrar.",
    inputSchema: DeleteJobSchema,
    handler: async (input: z.infer<typeof DeleteJobSchema>) => {
      try {
        const projectPath = await resolveProjectPath();
        if (!projectPath) return errorResult("delete-job", "NO_PROJECT", "No se detectó el proyecto de Talend: abre un proyecto en Studio o define TALEND_PROJECT.");
        const job = await findTalendJob(projectPath, input.jobName, input.folderPath);

        if (input.dryRun !== false) {
          return okResult({
            dryRun: true,
            deletedJob: input.jobName,
            itemPath: job.itemPath,
            propertiesPath: job.propertiesPath,
            snapshot: null,
          }, "delete-job");
        }

        if (input.confirm !== true) {
          return errorResult("delete-job", "CONFIRMATION_REQUIRED", "Borrar requiere confirm: true con dryRun: false.");
        }

        // No borrar un job abierto en Studio: pisaria el editor al guardar.
        try {
          const { jobsAbiertosEnStudio } = await import("../../../talend/job-batch/open-guard");
          const abiertos = await jobsAbiertosEnStudio([input.jobName]);
          if (abiertos.length > 0) {
            return errorResult("delete-job", "JOB_OPEN_IN_STUDIO", `El job ${input.jobName} esta abierto en Studio: cierra el editor antes de borrarlo.`);
          }
        } catch { /* sin bridge: se continua en disco */ }

        const snapshot = await createSnapshot(projectPath, job.itemPath, job.propertiesPath, "before_delete_job");
        if (!snapshot.ok) {
          return errorResult("delete-job", "SNAPSHOT_FAILED", `No se pudo crear el snapshot: ${snapshot.error ?? "error desconocido"}`);
        }

        await deleteTalendJob(projectPath, { jobName: input.jobName, folderPath: input.folderPath });
        return okResult({ deletedJob: input.jobName, itemPath: job.itemPath, propertiesPath: job.propertiesPath, snapshotId: snapshot.snapshotId }, "delete-job");
      } catch (err) {
        if (String(err).includes("no encontrado")) {
          return errorResult("delete-job", "JOB_NOT_FOUND", `Job no encontrado: ${input.jobName}`);
        }
        if (String(err).includes("ambiguo")) {
          return errorResult("delete-job", "JOB_AMBIGUOUS", `Job ambiguo: ${input.jobName}`);
        }
        return errorResult("delete-job", "DELETE_JOB_ERROR", `Error eliminando job: ${err}`);
      }
    },
  };
}
