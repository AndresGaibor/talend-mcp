import { moveTalendComponentXml } from "../../../talend/editor";
import { readTextFile, writeTextFile } from "../../../talend/files";
import { getConfiguredProjectPath } from "../../../talend/workspace";
import { findTalendJob } from "../../../talend/job-crud";
import { ok, fail } from "../common/response";
import { wrapHandler } from "../common/logger";

type MoveComponentOptions = {
  uniqueName: string;
  posX: number;
  posY: number;
};

export function createMoveComponentTool() {
  return {
    name: "move_talend_component",
    description: "Mueve un componente Talend a una nueva posición.",
    inputSchema: {
      type: "object",
      properties: {
        jobName: { type: "string", description: "Nombre del job" },
        folderPath: { type: "string", description: "Carpeta del job" },
        uniqueName: { type: "string", description: "Nombre único del componente" },
        posX: { type: "number", description: "Nueva posición X" },
        posY: { type: "number", description: "Nueva posición Y" },
      },
      required: ["jobName", "uniqueName", "posX", "posY"],
    },
    handler: wrapHandler("move_talend_component", async (input: MoveComponentOptions & { jobName: string; folderPath?: string }) => {
      const start = Date.now();
      try {
        const projectPath = getConfiguredProjectPath();
        if (!projectPath) return fail("NO_PROJECT", "No se detectó TALEND_PROJECT ni workspace activo.", { startTime: start });
        const job = await findTalendJob(projectPath, input.jobName, input.folderPath);
        const xml = await readTextFile(job.itemPath, projectPath);
        const updated = moveTalendComponentXml(xml, { uniqueName: input.uniqueName, posX: input.posX, posY: input.posY });
        await writeTextFile(job.itemPath, updated, projectPath);
        return ok({ itemPath: job.itemPath, uniqueName: input.uniqueName, posX: input.posX, posY: input.posY }, { startTime: start });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("no encontrado")) return fail("COMPONENT_NOT_FOUND", msg, { startTime: start });
        return fail("MOVE_COMPONENT_ERROR", msg, { startTime: start });
      }
    }),
  };
}