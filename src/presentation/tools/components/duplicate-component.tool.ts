import { duplicateTalendComponentXml } from "../../../talend/editor";
import { readTextFile, writeTextFile } from "../../../talend/files";
import { getConfiguredProjectPath } from "../../../talend/workspace";
import { findTalendJob } from "../../../talend/job-crud";
import { ok, fail } from "../common/response";
import { wrapHandler } from "../common/logger";

type DuplicateComponentOptions = {
  sourceUniqueName: string;
  targetUniqueName: string;
};

export function createDuplicateComponentTool() {
  return {
    name: "duplicate_talend_component",
    description: "Duplica un componente Talend existente.",
    inputSchema: {
      type: "object",
      properties: {
        jobName: { type: "string", description: "Nombre del job" },
        folderPath: { type: "string", description: "Carpeta del job" },
        sourceUniqueName: { type: "string", description: "Nombre único del componente fuente" },
        targetUniqueName: { type: "string", description: "Nombre único para el nuevo componente" },
      },
      required: ["jobName", "sourceUniqueName", "targetUniqueName"],
    },
    handler: wrapHandler("duplicate_talend_component", async (input: DuplicateComponentOptions & { jobName: string; folderPath?: string }) => {
      const start = Date.now();
      try {
        const projectPath = getConfiguredProjectPath();
        if (!projectPath) return fail("NO_PROJECT", "No se detectó TALEND_PROJECT ni workspace activo.", { startTime: start });
        const job = await findTalendJob(projectPath, input.jobName, input.folderPath);
        const xml = await readTextFile(job.itemPath, projectPath);
        const updated = duplicateTalendComponentXml(xml, { sourceUniqueName: input.sourceUniqueName, targetUniqueName: input.targetUniqueName });
        await writeTextFile(job.itemPath, updated, projectPath);
        return ok({ itemPath: job.itemPath, sourceUniqueName: input.sourceUniqueName, targetUniqueName: input.targetUniqueName }, { startTime: start });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("no encontrado")) return fail("COMPONENT_NOT_FOUND", msg, { startTime: start });
        return fail("DUPLICATE_COMPONENT_ERROR", msg, { startTime: start });
      }
    }),
  };
}