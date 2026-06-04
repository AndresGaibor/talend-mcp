import { addTalendConnectionXml } from "../../../talend/editor";
import { readTextFile, writeTextFile } from "../../../talend/files";
import { getConfiguredProjectPath } from "../../../talend/workspace";
import { findTalendJob } from "../../../talend/job-crud";
import { ok, fail } from "../common/response";
import { wrapHandler } from "../common/logger";

type AddConnectionOptions = {
  sourceUniqueName: string;
  targetUniqueName: string;
  label: string;
  connectorName: string;
  metaname: string;
  uniqueName: string;
};

export function createAddConnectionTool() {
  return {
    name: "add_talend_connection",
    description: "Añade una conexión entre dos componentes Talend.",
    inputSchema: {
      type: "object",
      properties: {
        jobName: { type: "string", description: "Nombre del job" },
        folderPath: { type: "string", description: "Carpeta del job" },
        sourceUniqueName: { type: "string", description: "Nombre único del componente origen" },
        targetUniqueName: { type: "string", description: "Nombre único del componente destino" },
        label: { type: "string", description: "Etiqueta de la conexión" },
        connectorName: { type: "string", description: "Nombre del conector" },
        metaname: { type: "string", description: "Nombre del meta" },
        uniqueName: { type: "string", description: "Nombre único para la conexión" },
      },
      required: ["jobName", "sourceUniqueName", "targetUniqueName", "label", "connectorName", "metaname", "uniqueName"],
    },
    handler: wrapHandler("add_talend_connection", async (input: AddConnectionOptions & { jobName: string; folderPath?: string }) => {
      const start = Date.now();
      try {
        const projectPath = getConfiguredProjectPath();
        if (!projectPath) return fail("NO_PROJECT", "No se detectó TALEND_PROJECT ni workspace activo.", { startTime: start });
        const job = await findTalendJob(projectPath, input.jobName, input.folderPath);
        const xml = await readTextFile(job.itemPath, projectPath);
        const updated = addTalendConnectionXml(xml, { sourceUniqueName: input.sourceUniqueName, targetUniqueName: input.targetUniqueName, label: input.label, connectorName: input.connectorName, metaname: input.metaname, uniqueName: input.uniqueName });
        await writeTextFile(job.itemPath, updated, projectPath);
        return ok({ itemPath: job.itemPath, sourceUniqueName: input.sourceUniqueName, targetUniqueName: input.targetUniqueName, uniqueName: input.uniqueName }, { startTime: start });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return fail("ADD_CONNECTION_ERROR", msg, { startTime: start });
      }
    }),
  };
}