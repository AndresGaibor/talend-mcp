import type { Job, JobComponent, PatchComponentOptions } from "../domain/job.types";
import type { IJobRepository } from "../ports/job-repository.port";

export class PatchComponentUseCase {
  constructor(private readonly repository: IJobRepository) {}

  async execute(options: PatchComponentOptions): Promise<Job> {
    const { jobId, componentId, configuration } = options;
    const job = await this.repository.findById(jobId);

    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    const componentIndex = job.components.findIndex((c: JobComponent) => c.id === componentId);
    if (componentIndex === -1) {
      throw new Error(`Component ${componentId} not found in job ${jobId}`);
    }

    const updatedComponents = [...job.components];
    const existingComponent = updatedComponents[componentIndex] as JobComponent;
    updatedComponents[componentIndex] = {
      ...existingComponent,
      configuration: {
        ...existingComponent.configuration,
        ...configuration,
      },
    };

    const updatedJob: Job = {
      ...job,
      components: updatedComponents,
      modifiedAt: new Date(),
    };

    return await this.repository.update(updatedJob);
  }
}