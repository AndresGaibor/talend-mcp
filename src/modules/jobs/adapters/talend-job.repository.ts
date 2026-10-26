import type { CreateJobOptions, Job, ListJobsOptions } from "../domain/job.types";
import type { IJobRepository } from "../ports/job-repository.port";
import { findJobById, findJobByName, findJobByPath, listJobs } from "./talend-job/job-reader";
import { createJob, deleteJob, updateJob } from "./talend-job/job-writer";

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
    return listJobs(options);
  }

  /** Un job por su id (la ruta de su `.item`). */
  async findById(id: string): Promise<Job | null> {
    return findJobById(id);
  }

  /** Un job por la ruta de su `.item` o de su `.properties`. */
  async findByPath(path: string): Promise<Job | null> {
    return findJobByPath(path);
  }

  /** Si existe el job. */
  async exists(id: string): Promise<boolean> {
    return (await this.findById(id)) !== null;
  }

  async create(options: CreateJobOptions): Promise<Job> {
    return createJob(options);
  }

  async update(job: Job): Promise<Job> {
    return updateJob(job);
  }

  /** Borra un job del proyecto, con la API de Studio. */
  async delete(id: string): Promise<void> {
    return deleteJob(id);
  }

  /**
   * Un job por su etiqueta (hay jobs con el mismo nombre en carpetas distintas).
   *
   * @param folder carpeta dentro de `process` (opcional).
   */
  async findByName(name: string, folder?: string): Promise<Job | null> {
    return findJobByName(name, folder);
  }
}
