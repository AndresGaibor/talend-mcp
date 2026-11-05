import { z } from "zod/v4";
import { okResult, errorResult } from "../../../presentation/tools/common/result";
import { findTalendJob } from "../../../talend/job-crud";
import { readTextFile } from "../../../talend/files";
import { resolveProjectPath } from "../../../talend/workspace";
import { parseJobItem } from "../../../talend/job-parser";

const InspectSchema = z.object({
  job: z.string().describe("Nombre del job"),
  folderPath: z.string().optional().describe("Carpeta del job"),
  detail: z.enum(["summary", "full"]).optional().default("summary").describe("summary: componentes+conexiones; full: + XML"),
});

/** Fachada canónica: agrupa talend_jobs_read / talend_inspect_job / talend_job_info. */
export function createJobInspectTool() {
  return {
    name: "talend_job_inspect",
    description: "Inspecciona un job (componentes, conexiones, contextos). detail=full incluye el XML del .item.",
    inputSchema: InspectSchema,
    handler: async (input: z.infer<typeof InspectSchema>) => {
      try {
        const projectPath = await resolveProjectPath();
        if (!projectPath) return errorResult("job-inspect", "NO_PROJECT", "No se detectó el proyecto de Talend.");
        const job = await findTalendJob(projectPath, input.job, input.folderPath);
        const xml = await readTextFile(job.itemPath, projectPath);
        const parsed = parseJobItem(xml, job.itemPath);
        const data: Record<string, unknown> = {
          job: (job as any).name ?? input.job,
          itemPath: job.itemPath,
          propertiesPath: job.propertiesPath,
          components: parsed.components.map((c: any) => ({ uniqueName: c.uniqueName, type: c.componentName, label: c.label })),
          connections: parsed.connections.map((c: any) => ({ source: c.source, target: c.target, type: c.connectorName ?? c.type, label: c.label })),
          contexts: parsed.contexts ?? [],
        };
        if (input.detail === "full") {
          data.item = { components: parsed.components.length, connections: parsed.connections.length };
        }
        return okResult(data, "job-inspect");
      } catch (err) {
        return errorResult("job-inspect", "INSPECT_ERROR", `Error inspeccionando job: ${err}`);
      }
    },
  };
}
