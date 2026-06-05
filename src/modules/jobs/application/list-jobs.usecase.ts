import type { Job, ListJobsOptions } from "../domain/job.types";
import type { IJobRepository } from "../ports/job-repository.port";

export class ListJobsUseCase {
  constructor(private readonly repository: IJobRepository) {}

  async execute(options?: ListJobsOptions): Promise<Job[]> {
    return await this.repository.list(options);
  }
}