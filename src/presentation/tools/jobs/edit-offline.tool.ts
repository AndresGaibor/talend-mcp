import { z } from "zod/v4";
import { applyJobEdits, jobEditOperationSchema } from "../../../talend/editor/job-edit";
import { findTalendJob } from "../../../talend/job-crud";
import { readTextFile, writeTextFile } from "../../../talend/files";
import { resolveProjectPath } from "../../../talend/workspace";
import { jobsAbiertosEnStudio } from "../../../talend/job-batch/open-guard";
import { okResult, errorResult } from "../common/result";

const EditOfflineSchema = z.object({
  job: z.string().min(1).describe("Nombre del job"),
  folderPath: z.string().optional().describe("Carpeta del job, si hay dos con el mismo nombre"),
  operations: z.array(jobEditOperationSchema).min(1).max(500)
    .describe("Operaciones en orden: add_node, remove_node, set_params, set_schema, connect, disconnect, move, set_context"),
  force: z.boolean().optional().default(false)
    .describe("Editar aunque Studio tenga el job abierto en un editor (al guardar, Studio pisaria el cambio)"),
  dryRun: z.boolean().optional().default(false)
    .describe("Con true no escribe: devuelve solo el diff y las comprobaciones"),
  refreshStudio: z.boolean().optional().default(true)
    .describe("Refrescar el workspace de Studio si esta abierto, para que vea el cambio"),
});

/**
 * Edita un job en disco sin Studio. Todo el lote se aplica o no se aplica nada: si una operacion falla o el job
 * quedaria inconsistente (conexion a un nodo que no existe, nombre repetido) no se escribe el fichero.
 */
export function createJobEditOfflineTool() {
  return {
    name: "talend_job_edit_offline",
    description:
      "Edita un job EXISTENTE directamente en su fichero .item, sin abrir Talend Studio: anade o quita componentes, cambia parametros y esquemas, conecta, mueve y pone variables de contexto, todo en un lote atomico (o se aplica entero o no se toca nada). Comprueba la integridad (nombres unicos, conexiones con extremos que existen). Con dryRun devuelve el diff sin escribir. Para crear un job desde cero usa talend_jobs_create_from_spec; para comprobar que compila y ejecuta usa talend_job_verify o talend_job_build_batch.",
    inputSchema: EditOfflineSchema,
    annotations: { readOnly: false, requiresConfirmation: true },
    handler: async (input: z.infer<typeof EditOfflineSchema>) => {
      const tool = "job-edit-offline";
      try {
        const projectPath = await resolveProjectPath();
        if (!projectPath) {
          return errorResult(tool, "NO_PROJECT", "No se pudo detectar el proyecto Talend. Define TALEND_PROJECT.");
        }
        const job = await findTalendJob(projectPath, input.job, input.folderPath);
        if (!input.dryRun && !input.force) {
          const abiertos = await jobsAbiertosEnStudio([input.job]);
          if (abiertos.length > 0) {
            return errorResult(tool, "JOB_OPEN_IN_STUDIO", `El job ${input.job} esta abierto en un editor de Studio: al guardarlo, Studio pisaria el cambio. Cierralo (o usa talend_job_* de la API de Studio), o repite con force:true.`);
          }
        }
        const xml = await readTextFile(job.itemPath, projectPath);

        let result;
        try {
          result = applyJobEdits(xml, input.operations);
        } catch (error) {
          return errorResult(tool, "EDIT_REJECTED", error instanceof Error ? error.message : String(error));
        }

        const written = !input.dryRun && result.changed;
        if (written) await writeTextFile(job.itemPath, result.xml, projectPath);

        let studioRefreshed = false;
        if (written && input.refreshStudio) {
          try {
            const { createBridgeClient } = await import("../../../modules/studio-bridge/adapters/http-studio-bridge.client");
            const bridge = await createBridgeClient();
            studioRefreshed = (await bridge.refreshWorkspace()).ok;
          } catch {
            // Studio cerrado: el cambio ya esta en disco y lo vera al abrirlo.
          }
        }

        return okResult(
          {
            job: input.job,
            itemPath: job.itemPath,
            operations: input.operations.length,
            changed: result.changed,
            written,
            studioRefreshed,
            diff: result.diff.length > 6000 ? `${result.diff.slice(0, 6000)}\n... (diff recortado)` : result.diff,
          },
          tool,
        );
      } catch (error) {
        return errorResult(tool, "EDIT_OFFLINE_ERROR", error instanceof Error ? error.message : String(error));
      }
    },
  };
}
