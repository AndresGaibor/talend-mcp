import type { IJobRepository } from "../../domain/job/job.repository";

export class ListJobsUseCase {
  constructor(private jobRepo: IJobRepository) {}

  async execute(projectPath: string): Promise<string[]> {
    if (!projectPath) {
      throw new Error("Ruta de proyecto es requerida");
    }
    return this.jobRepo.listJobs(projectPath);
  }
}