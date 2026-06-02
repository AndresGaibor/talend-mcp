import type {
  ParsedJob,
  TalendComponentInspection,
  TalendJobInspection,
} from "./types";
import { findSchemaIssues } from "./analysis";

function findComponent(job: ParsedJob, uniqueName: string) {
  const component = job.components.find((item) => item.uniqueName === uniqueName);
  if (!component) throw new Error("Componente no encontrado.");
  return component;
}

function connectionsForComponent(job: ParsedJob, uniqueName: string) {
  return {
    incomingConnections: job.connections.filter((connection) => connection.target === uniqueName),
    outgoingConnections: job.connections.filter((connection) => connection.source === uniqueName),
  };
}

export function inspectTalendComponent(
  job: ParsedJob,
  options: { uniqueName: string; includeRaw?: boolean },
): TalendComponentInspection {
  const component = findComponent(job, options.uniqueName);
  const { incomingConnections, outgoingConnections } = connectionsForComponent(job, options.uniqueName);

  return {
    component,
    incomingConnections,
    outgoingConnections,
    raw: options.includeRaw ? { nodeAttributes: component.nodeAttributes } : undefined,
  };
}

export function inspectTalendJob(job: ParsedJob): TalendJobInspection {
  const components = job.components.map((component) => inspectTalendComponent(job, { uniqueName: component.uniqueName }));
  const schemaIssues = findSchemaIssues(job);

  return {
    job,
    components,
    connections: job.connections,
    contexts: job.contexts,
    mapperEntries: job.mapperEntries,
    schemaIssues,
    stats: {
      componentCount: job.components.length,
      connectionCount: job.connections.length,
      contextCount: job.contexts.length,
      mapperEntryCount: job.mapperEntries.length,
      schemaIssueCount: schemaIssues.length,
    },
  };
}
