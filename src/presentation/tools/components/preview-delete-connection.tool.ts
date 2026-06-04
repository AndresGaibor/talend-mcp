import { buildTalendConnectionDeletePreview } from "../../../talend/editor";
import { readTextFile } from "../../../talend/files";
import { getConfiguredProjectPath } from "../../../talend/workspace";
import { findTalendJob } from "../../../talend/job-crud";
import { ok, fail } from "../common/response";
import { wrapHandler } from "../common/logger";

type DeleteConnectionOptions = {
  uniqueName: string;
};

export function createPreviewDeleteConnectionTool() {
  return {
    name: "preview_delete_talend_connection",
    description: "Muestra previsualización de eliminación de una conexión Talend.",
    inputSchema: {
      type: "object",
      properties: {
        jobName: { type: "string", description: "Nombre del job" },
        folderPath: { type: "string", description: "Carpeta del job" },
        uniqueName: { type: "string", description: "Nombre único de la conexión a eliminar" },
      },
      required: ["jobName", "uniqueName"],
    },
    handler: wrapHandler("preview_delete_talend_connection", async (input: DeleteConnectionOptions & { jobName: string; folderPath?: string }) => {
      const start = Date.now();
      try {
        const projectPath = getConfiguredProjectPath();
        if (!projectPath) return fail("NO_PROJECT", "No se detectó TALEND_PROJECT ni workspace activo.", { startTime: start });
        const job = await findTalendJob(projectPath, input.jobName, input.folderPath);
        const xml = await readTextFile(job.itemPath, projectPath);
        const result = buildTalendConnectionDeletePreview(xml, { uniqueName: input.uniqueName });
        return ok({ itemPath: job.itemPath, uniqueName: input.uniqueName, changed: result.changed, diff: result.diff }, { startTime: start });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("no encontrado")) return fail("CONNECTION_NOT_FOUND", msg, { startTime: start });
        return fail("PREVIEW_DELETE_CONNECTION_ERROR", msg, { startTime: start });
      }
    }),
  };
}