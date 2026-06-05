import type { Job, JobMetadata, ListJobsOptions, CreateJobOptions } from "../domain/job.types";

export interface IJobRepository {
  list(options?: ListJobsOptions): Promise<Job[]>;
  findById(id: string): Promise<Job | null>;
  findByPath(path: string): Promise<Job | null>;
  create(options: CreateJobOptions): Promise<Job>;
  update(job: Job): Promise<Job>;
  delete(id: string): Promise<void>;
  exists(id: string): Promise<boolean>;
}

export interface IJobMetadataStore {
  save(metadata: JobMetadata): Promise<void>;
  findById(id: string): Promise<JobMetadata | null>;
  list(limit?: number, offset?: number): Promise<JobMetadata[]>;
  delete(id: string): Promise<void>;
  update(id: string, updates: Partial<JobMetadata>): Promise<void>;
}