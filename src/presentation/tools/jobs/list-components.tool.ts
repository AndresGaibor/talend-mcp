import { z } from "zod/v4";
import { JobXmlRepository } from "../../../infrastructure/repositories/job-xml.repository";
import { ok, fail } from "../common/response";

const ListComponentsSchema = z.object({
  jobName: z.string().describe("Nombre del job"),
  folderPath: z.string().optional().describe("Carpeta del job"),
});

export function createListComponentsTool() {
  return {
    name: "talend_list_components",
    description: "Lista todos los componentes de un job.",
    inputSchema: ListComponentsSchema,
    handler: async (input: z.infer<typeof ListComponentsSchema>) => {
      try {
        const projectPath = process.env.TALEND_PROJECT;
        if (!projectPath) return fail("NO_PROJECT", "No se detectó TALEND_PROJECT.");
        const repo = new JobXmlRepository();
        const jobs = await repo.listJobs(projectPath);
        const jobPath = jobs.find((j: string) => {
          const nameFromPath = j.split("/").pop()?.replace(/_\d+\.\d+\.item$/, "") ?? "";
          return nameFromPath === input.jobName;
        });
        if (!jobPath) return fail("JOB_NOT_FOUND", `Job no encontrado: ${input.jobName}`);
        const parsed = await repo.parseJob(jobPath);
        return ok({
          jobName: input.jobName,
          components: parsed.components.map((c: { uniqueName: string; componentName: string; label?: string }) => ({
            uniqueName: c.uniqueName,
            componentName: c.componentName,
            label: c.label,
          })),
          count: parsed.components.length,
        });
      } catch (err) {
        return fail("LIST_COMPONENTS_ERROR", `Error listando componentes: ${err}`);
      }
    },
  };
}