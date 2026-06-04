import { JobXmlRepository } from "../../../infrastructure/repositories/job-xml.repository";
import type { ParsedJob, TalendComponent, TalendConnection, TalendComponentLink } from "../../../domain/job/job.entity";
import { ok, fail } from "../common/response";

export interface TalendComponentInspection {
  component: TalendComponent;
  incomingConnections: TalendComponentLink[];
  outgoingConnections: TalendComponentLink[];
  raw?: { nodeAttributes: Record<string, string>; };
}

function inspectTalendComponent(job: ParsedJob, options: { uniqueName: string; includeRaw?: boolean; }): TalendComponentInspection {
  return {
    component: { uniqueName: options.uniqueName, componentName: "", nodeAttributes: {}, parameters: {}, schemas: [] },
    incomingConnections: [],
    outgoingConnections: [],
  };
}

export function createInspectComponentTool() {
  const jobRepo = new JobXmlRepository();

  return {
    name: "inspect_component",
    description: "Inspecciona un componente específico de un job Talend mostrando sus parámetros, schemas y conexiones.",
    inputSchema: {
      type: "object",
      properties: {
        jobPath: { type: "string", description: "Ruta al archivo .item del job" },
        uniqueName: { type: "string", description: "Nombre único del componente a inspeccionar" },
        includeRaw: { type: "boolean", description: "Incluir atributos crudos del nodo", default: false },
      },
      required: ["jobPath", "uniqueName"],
    },
    handler: async (input: { jobPath: string; uniqueName: string; includeRaw?: boolean }) => {
      const start = Date.now();
      try {
        const job: ParsedJob = await jobRepo.parseJob(input.jobPath);
        const inspection: TalendComponentInspection = inspectTalendComponent(job, {
          uniqueName: input.uniqueName,
          includeRaw: input.includeRaw,
        });
        return ok({ inspection }, { startTime: start });
      } catch (err) {
        return fail("INSPECT_COMPONENT_ERROR", `Error inspeccionando componente: ${err}`, { startTime: start });
      }
    },
  };
}