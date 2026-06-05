import type { Job, CreateJobOptions } from "../domain/job.types";
import type { IJobRepository } from "../ports/job-repository.port";

export class CreateJobUseCase {
  constructor(private readonly repository: IJobRepository) {}

  async execute(options: CreateJobOptions): Promise<Job> {
    return await this.repository.create(options);
  }
}