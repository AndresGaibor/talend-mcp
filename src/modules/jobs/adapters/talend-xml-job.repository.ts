import type { Job, ListJobsOptions, CreateJobOptions } from "../domain/job.types";
import type { IJobRepository } from "../ports/job-repository.port";

export class TalendXmlJobRepository implements IJobRepository {
  async list(options?: ListJobsOptions): Promise<Job[]> {
    return [];
  }

  async findById(id: string): Promise<Job | null> {
    return null;
  }

  async findByPath(path: string): Promise<Job | null> {
    return null;
  }

  async create(options: CreateJobOptions): Promise<Job> {
    throw new Error("Not implemented");
  }

  async update(job: Job): Promise<Job> {
    throw new Error("Not implemented");
  }

  async delete(id: string): Promise<void> {
    throw new Error("Not implemented");
  }

  async exists(id: string): Promise<boolean> {
    return false;
  }
}