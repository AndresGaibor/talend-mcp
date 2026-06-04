import { deleteTalendComponentXml } from "../../../talend/editor";
import { readTextFile, writeTextFile } from "../../../talend/files";
import { getConfiguredProjectPath } from "../../../talend/workspace";
import { findTalendJob } from "../../../talend/job-crud";
import { ok, fail } from "../common/response";
import { wrapHandler } from "../common/logger";

type DeleteComponentOptions = {
  uniqueName: string;
};

export function createDeleteComponentTool() {
  return {
    name: "delete_talend_component",
    description: "Elimina un componente Talend y sus conexiones.",
    inputSchema: {
      type: "object",
      properties: {
        jobName: { type: "string", description: "Nombre del job" },
        folderPath: { type: "string", description: "Carpeta del job" },
        uniqueName: { type: "string", description: "Nombre único del componente a eliminar" },
      },
      required: ["jobName", "uniqueName"],
    },
    handler: wrapHandler("delete_talend_component", async (input: DeleteComponentOptions & { jobName: string; folderPath?: string }) => {
      const start = Date.now();
      try {
        const projectPath = getConfiguredProjectPath();
        if (!projectPath) return fail("NO_PROJECT", "No se detectó TALEND_PROJECT ni workspace activo.", { startTime: start });
        const job = await findTalendJob(projectPath, input.jobName, input.folderPath);
        const xml = await readTextFile(job.itemPath, projectPath);
        const updated = deleteTalendComponentXml(xml, { uniqueName: input.uniqueName });
        await writeTextFile(job.itemPath, updated, projectPath);
        return ok({ itemPath: job.itemPath, uniqueName: input.uniqueName }, { startTime: start });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("no encontrado")) return fail("COMPONENT_NOT_FOUND", msg, { startTime: start });
        return fail("DELETE_COMPONENT_ERROR", msg, { startTime: start });
      }
    }),
  };
}