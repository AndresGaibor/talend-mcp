import type { IJobRepository, JobSpec } from "../../domain/job/job.repository";

export class CreateJobUseCase {
  constructor(private jobRepo: IJobRepository) {}

  async execute(projectPath: string, name: string, spec?: JobSpec): Promise<string> {
    if (!projectPath) {
      throw new Error("Ruta de proyecto es requerida");
    }
    if (!name) {
      throw new Error("Nombre de job es requerido");
    }
    return this.jobRepo.createJob(projectPath, name, spec);
  }
}