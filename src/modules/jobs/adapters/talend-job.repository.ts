import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { listTalendJobs } from "../../../infrastructure/repositories/job-xml/job-properties-xml";
import { parseXmlToJob } from "../../../infrastructure/repositories/job-xml/xml-parsers";
import { readTextFile } from "../../../infrastructure/filesystem/file-reader";
import { getConfiguredProjectPath } from "../../../talend/workspace";
import { TalendStudioBridgeClient } from "../../studio-bridge/adapters/http-studio-bridge.client";
import type { TalendJobResource } from "../../../domain/job/job.entity";
import type {
  CreateJobOptions,
  Job,
  JobComponent,
  JobConnection,
  JobStatus,
  ListJobsOptions,
} from "../domain/job.types";
import type { IJobRepository } from "../ports/job-repository.port";

/**
 * Los jobs de un proyecto de Talend.
 *
 * **Lecturas**: se leen del proyecto (los `.item` y sus `.properties`), asi que
 * no hace falta que Studio este abierto.
 *
 * **Escrituras**: van por la API de Studio, no escribiendo el `.item` a mano.
 * Un job creado o modificado asi lo guarda el IDE como lo espera, y el
 * repositorio de Talend no se queda con items fantasma.
 */
export class TalendJobRepository implements IJobRepository {
  /** Todos los jobs del proyecto. */
  async list(options?: ListJobsOptions): Promise<Job[]> {
    const projectPath = resolveProjectPath(options?.path);
    const recursos = await listTalendJobs(projectPath);

    let jobs: Job[] = [];
    for (const recurso of recursos) {
      const job = await toJob(projectPath, recurso);
      if (job) jobs.push(job);
    }

    // El filtro por ruta: la carpeta dentro de `process`.
    if (options?.path && !isProjectPath(options.path)) {
      const filtro = normalize(options.path);
      jobs = jobs.filter((job) => normalize(job.path).includes(filtro));
    }

    if (options?.status) {
      jobs = jobs.filter((job) => job.status === options.status);
    }

    const offset = options?.offset ?? 0;
    const limit = options?.limit ?? jobs.length;
    return jobs.slice(offset, offset + limit);
  }

  /** Un job por su id (la ruta de su `.item`). */
  async findById(id: string): Promise<Job | null> {
    const jobs = await this.list();
    return jobs.find((job) => job.id === id) ?? null;
  }

  /** Un job por la ruta de su `.item` o de su `.properties`. */
  async findByPath(path: string): Promise<Job | null> {
    const wanted = normalize(path);
    const jobs = await this.list();
    return (
      jobs.find((job) => normalize(job.path) === wanted) ??
      jobs.find((job) => normalize(job.path.replace(/\.item$/, ".properties")) === wanted) ??
      null
    );
  }

  /** Si existe el job. */
  async exists(id: string): Promise<boolean> {
    return (await this.findById(id)) !== null;
  }

  /**
   * Crea un job en el proyecto, con la API de Studio.
   *
   * `options.path` es la carpeta dentro de `process` donde va el job.
   */
  async create(options: CreateJobOptions): Promise<Job> {
    const bridge = await TalendStudioBridgeClient.create();
    const result = await bridge.createJob({
      name: options.name,
      folder: folderOf(options.path),
      description: options.description,
    });
    if (!result.ok) {
      throw new Error(result.error?.message ?? "Studio no pudo crear el job");
    }

    const job = await this.findByName(options.name);
    if (!job) {
      throw new Error(`El job '${options.name}' se creo pero no aparece en el proyecto`);
    }
    return job;
  }

  /**
   * Aplica los cambios de un job, con la API de Studio.
   *
   * Se reconfiguran los componentes que tengan parametros: cada cambio se
   * manda a Studio, que es quien los guarda.
   */
  async update(job: Job): Promise<Job> {
    const bridge = await TalendStudioBridgeClient.create();
    for (const component of job.components) {
      const parameters: Record<string, { value: string }> = {};
      for (const [nombre, valor] of Object.entries(component.configuration ?? {})) {
        if (valor === undefined || valor === null) continue;
        parameters[nombre] = { value: typeof valor === "string" ? valor : JSON.stringify(valor) };
      }
      if (Object.keys(parameters).length === 0) continue;

      const result = await bridge.configureNode({
        job: job.name,
        uniqueName: component.id,
        parameters,
      });
      if (!result.ok) {
        throw new Error(
          `No se pudo configurar '${component.id}' del job '${job.name}': ` +
            (result.error?.message ?? "error desconocido"),
        );
      }
    }
    return (await this.findById(job.id)) ?? job;
  }

  /** Borra un job del proyecto, con la API de Studio. */
  async delete(id: string): Promise<void> {
    const job = await this.findById(id);
    if (!job) {
      throw new Error(`No existe el job '${id}'`);
    }
    const bridge = await TalendStudioBridgeClient.create();
    const result = await bridge.deleteJob({ name: job.name, version: job.version });
    if (!result.ok) {
      throw new Error(result.error?.message ?? "Studio no pudo borrar el job");
    }
  }

  /**
   * Un job por su etiqueta (hay jobs con el mismo nombre en carpetas distintas).
   *
   * @param folder carpeta dentro de `process` (opcional).
   */
  async findByName(name: string, folder?: string): Promise<Job | null> {
    const jobs = await this.list();
    const candidates = jobs.filter((job) => job.name === name);
    if (candidates.length === 0) return null;
    if (!folder) return candidates[0] ?? null;
    const wanted = normalize(folder);
    return (
      candidates.find((job) => normalize(job.path).includes(`/process/${wanted}/`)) ??
      candidates.find((job) => normalize(job.path).includes(wanted)) ??
      null
    );
  }
}

/**
 * La ruta del proyecto de Talend.
 *
 * Se usa la que haya configurada (la del proyecto abierto en Studio) y, si se
 * pasa una ruta, la que tenga una carpeta `process`.
 */
function resolveProjectPath(candidate?: string): string {
  if (candidate) {
    const absoluta = resolve(candidate);
    if (isProjectPath(absoluta)) return absoluta;
  }
  const configured = getConfiguredProjectPath();
  if (!configured) {
    throw new Error(
      "No se ha podido determinar el proyecto de Talend: abre un proyecto en Studio o define TALEND_PROJECT",
    );
  }
  return configured;
}

/** Si una ruta es la de un proyecto de Talend (tiene la carpeta `process`). */
function isProjectPath(candidate: string): boolean {
  try {
    return existsSync(join(resolve(candidate), "process"));
  } catch {
    return false;
  }
}

/** La carpeta dentro de `process` donde va un job. */
function folderOf(path: string): string {
  const normalized = normalize(path);
  const marker = "/process/";
  const cut = normalized.indexOf(marker);
  if (cut >= 0) return normalized.slice(cut + marker.length);
  return normalized.replace(/^\/+/, "");
}

/** Normaliza una ruta para comparar: separadores y sin barra final. */
function normalize(path: string): string {
  return path.replace(/\\/g, "/").replace(/\/+$/, "");
}

/** Convierte un job del proyecto en el tipo del dominio. */
async function toJob(projectPath: string, recurso: TalendJobResource): Promise<Job | null> {
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
