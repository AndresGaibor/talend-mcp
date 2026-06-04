import { buildTalendComponentEditPreview } from "../../../talend/editor";
import { readTextFile } from "../../../talend/files";
import { getConfiguredProjectPath } from "../../../talend/workspace";
import { findTalendJob } from "../../../talend/job-crud";
import { ok, fail } from "../common/response";
import { wrapHandler } from "../common/logger";

type ParameterEditOptions = {
  uniqueName: string;
  parameterName: string;
  value: string;
};

export function createPreviewParameterTool() {
  return {
    name: "preview_talend_component_parameter",
    description: "Muestra una previsualización del cambio en un parámetro de componente Talend.",
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
    handler: wrapHandler("preview_talend_component_parameter", async (input: ParameterEditOptions & { jobName: string; folderPath?: string }) => {
      const start = Date.now();
      try {
        const projectPath = getConfiguredProjectPath();
        if (!projectPath) return fail("NO_PROJECT", "No se detectó TALEND_PROJECT ni workspace activo.", { startTime: start });
        const job = await findTalendJob(projectPath, input.jobName, input.folderPath);
        const xml = await readTextFile(job.itemPath, projectPath);
        const result = buildTalendComponentEditPreview(xml, { kind: "parameter", uniqueName: input.uniqueName, parameterName: input.parameterName, value: input.value });
        return ok({ itemPath: job.itemPath, uniqueName: input.uniqueName, changed: result.changed, diff: result.diff }, { startTime: start });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("no encontrado")) return fail("COMPONENT_NOT_FOUND", msg, { startTime: start });
        return fail("PREVIEW_PARAMETER_ERROR", msg, { startTime: start });
      }
    }),
  };
}