import { parseXmlToJob } from "../../../../infrastructure/repositories/job-xml/xml-parsers";
import { readTextFile } from "../../../../infrastructure/filesystem/file-reader";
import type { TalendJobResource } from "../../../../domain/job/job.entity";
import type { Job, JobComponent, JobConnection, JobStatus } from "../../domain/job.types";

/** Convierte un job del proyecto en el tipo del dominio. */
export async function toJob(projectPath: string, recurso: TalendJobResource): Promise<Job | null> {
  let parsed;
  try {
    const xml = await readTextFile(recurso.itemPath, projectPath);
    parsed = parseXmlToJob(xml, recurso.itemPath);
  } catch {
    return null;
  }

  const components: JobComponent[] = parsed.components.map((component) => ({
    id: component.uniqueName,
    name: component.label ?? component.uniqueName,
    type: component.componentName,
    configuration: { ...component.parameters },
    position: {
      x: Number(component.nodeAttributes?.posX ?? 0),
      y: Number(component.nodeAttributes?.posY ?? 0),
    },
  }));

  const connections: JobConnection[] = parsed.connections.map((connection) => ({
    id: connection.uniqueName ?? `${connection.source}->${connection.target}`,
    sourceComponentId: connection.source,
    targetComponentId: connection.target,
    schema: connection.connectorName ? { connector: connection.connectorName } : undefined,
  }));

  return {
    id: recurso.itemPath,
    name: recurso.label,
    version: recurso.version,
    path: recurso.itemPath,
    description: recurso.description ?? recurso.purpose,
    createdAt: new Date(recurso.createdDate ?? 0),
    modifiedAt: new Date(recurso.modifiedDate ?? 0),
    status: statusOf(recurso),
    components,
    connections,
  };
}

/**
 * El estado del job.
 *
 * Talend no guarda un estado de "desarrollo" o "produccion" en el job: el
 * `statusCode` de las propiedades es el que se usa.
 */
function statusOf(recurso: TalendJobResource): JobStatus {
  const code = (recurso.statusCode ?? "").toUpperCase();
  if (code === "ARCHIVED") return "archived";
  if (code === "PRODUCTION") return "production";
  return "development";
}
