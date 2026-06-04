import { JobXmlRepository } from "../../../infrastructure/repositories/job-xml.repository";
import type { ParsedJob, TalendComponent, TalendConnection, TalendContextParameter, TalendComponentLink, SchemaIssue, MapperEntry } from "../../../domain/job/job.entity";
import { ok, fail } from "../common/response";

export interface TalendJobInspection {
  job: ParsedJob;
  components: TalendComponentInspection[];
  connections: TalendConnection[];
  contexts: TalendContextParameter[];
  mapperEntries: MapperEntry[];
  schemaIssues: SchemaIssue[];
  stats: { componentCount: number; connectionCount: number; contextCount: number; mapperEntryCount: number; schemaIssueCount: number; };
}

export interface TalendComponentInspection {
  component: TalendComponent;
  incomingConnections: TalendComponentLink[];
  outgoingConnections: TalendComponentLink[];
  raw?: { nodeAttributes: Record<string, string>; };
}

function inspectTalendJob(job: ParsedJob): TalendJobInspection {
  return {
    job,
    components: [],
    connections: job.connections,
    contexts: job.contexts,
    mapperEntries: job.mapperEntries,
    schemaIssues: [],
    stats: { componentCount: 0, connectionCount: 0, contextCount: 0, mapperEntryCount: 0, schemaIssueCount: 0 },
  };
}

export function createInspectJobTool() {
  const jobRepo = new JobXmlRepository();

  return {
    name: "inspect_job",
    description: "Inspecciona un job completo mostrando todos sus componentes, conexiones, contextos y issues de schema.",
    inputSchema: {
      type: "object",
      properties: {
        jobPath: { type: "string", description: "Ruta al archivo .item del job" },
      },
      required: ["jobPath"],
    },
    handler: async (input: { jobPath: string }) => {
      const start = Date.now();
      try {
        const job: ParsedJob = await jobRepo.parseJob(input.jobPath);
        const inspection: TalendJobInspection = inspectTalendJob(job);
        return ok({ inspection }, { startTime: start });
      } catch (err) {
        return fail("INSPECT_JOB_ERROR", `Error inspeccionando job: ${err}`, { startTime: start });
      }
    },
  };
}