import type { Job, ReadJobOptions } from "../domain/job.types";
import type { IJobRepository } from "../ports/job-repository.port";

export class ReadJobUseCase {
  constructor(private readonly repository: IJobRepository) {}

  async execute(jobId: string, options?: ReadJobOptions): Promise<Job | null> {
    const job = await this.repository.findById(jobId);
    return job;
  }
}