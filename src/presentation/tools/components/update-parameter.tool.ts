import { updateTalendComponentParameterXml } from "../../../talend/editor";
import { readTextFile, writeTextFile } from "../../../talend/files";
import { getConfiguredProjectPath } from "../../../talend/workspace";
import { findTalendJob } from "../../../talend/job-crud";
import { ok, fail } from "../common/response";
import { wrapHandler } from "../common/logger";

type ParameterEditOptions = {
  uniqueName: string;
  parameterName: string;
  value: string;
};

export function createUpdateParameterTool() {
  return {
    name: "update_talend_component_parameter",
    description: "Actualiza un parámetro de un componente Talend.",
    inputSchema: {
      type: "object",
      properties: {
        jobName: { type: "string", description: "Nombre del job" },
        folderPath: { type: "string", description: "Carpeta del job" },
        uniqueName: { type: "string", description: "Nombre único del componente" },
        parameterName: { type: "string", description: "Nombre del parámetro" },
        value: { type: "string", description: "Nuevo valor del parámetro" },
      },
      required: ["jobName", "uniqueName", "parameterName", "value"],
    },
    handler: wrapHandler("update_talend_component_parameter", async (input: ParameterEditOptions & { jobName: string; folderPath?: string }) => {
      const start = Date.now();
      try {
        const projectPath = getConfiguredProjectPath();
        if (!projectPath) return fail("NO_PROJECT", "No se detectó TALEND_PROJECT ni workspace activo.", { startTime: start });
        const job = await findTalendJob(projectPath, input.jobName, input.folderPath);
        const xml = await readTextFile(job.itemPath, projectPath);
        const updated = updateTalendComponentParameterXml(xml, { uniqueName: input.uniqueName, parameterName: input.parameterName, value: input.value });
        await writeTextFile(job.itemPath, updated, projectPath);
        return ok({ itemPath: job.itemPath, uniqueName: input.uniqueName, parameterName: input.parameterName }, { startTime: start });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("no encontrado")) return fail("COMPONENT_NOT_FOUND", msg, { startTime: start });
        return fail("UPDATE_PARAMETER_ERROR", msg, { startTime: start });
      }
    }),
  };
}