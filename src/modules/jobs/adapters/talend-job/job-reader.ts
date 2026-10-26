import { listTalendJobs } from "../../../../infrastructure/repositories/job-xml/job-properties-xml";
import type { Job, ListJobsOptions } from "../../domain/job.types";
import { toJob } from "./job-mapper";
import { isProjectPath, normalize, resolveProjectPath } from "./project-path";

/** Todos los jobs del proyecto. */
export async function listJobs(options?: ListJobsOptions): Promise<Job[]> {
  const projectPath = resolveProjectPath(options?.path);
  const recursos = await listTalendJobs(projectPath);

  let jobs: Job[] = [];
  const batchSize = 16;
  for (let i = 0; i < recursos.length; i += batchSize) {
    const batch = await Promise.all(recursos.slice(i, i + batchSize).map((recurso) => toJob(projectPath, recurso)));
    jobs.push(...batch.filter((job): job is Job => job !== null));
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
export async function findJobById(id: string): Promise<Job | null> {
  const projectPath = resolveProjectPath();
  const recursos = await listTalendJobs(projectPath);
  const wanted = normalize(id);
  const recurso = recursos.find((item) => normalize(item.itemPath) === wanted);
  return recurso ? toJob(projectPath, recurso) : null;
}

/** Un job por la ruta de su `.item` o de su `.properties`. */
export async function findJobByPath(path: string): Promise<Job | null> {
  const projectPath = resolveProjectPath();
  const wanted = normalize(path);
  const recursos = await listTalendJobs(projectPath);
  const recurso = recursos.find((item) => normalize(item.itemPath) === wanted)
    ?? recursos.find((item) => normalize(item.propertiesPath) === wanted);
  return recurso ? toJob(projectPath, recurso) : null;
}

/**
 * Un job por su etiqueta (hay jobs con el mismo nombre en carpetas distintas).
 *
 * @param folder carpeta dentro de `process` (opcional).
 */
export async function findJobByName(name: string, folder?: string): Promise<Job | null> {
  const projectPath = resolveProjectPath();
  const recursos = await listTalendJobs(projectPath);
  const candidates = recursos.filter((recurso) => recurso.label === name);
  if (candidates.length === 0) return null;
  if (!folder) return toJob(projectPath, candidates[0]!);
  const wanted = normalize(folder);
  const matching = candidates.find((recurso) => normalize(recurso.itemPath).includes(`/process/${wanted}/`))
    ?? candidates.find((recurso) => normalize(recurso.itemPath).includes(wanted));
  return matching ? toJob(projectPath, matching) : null;
}
