import type { PipelineSpec, ApplyPipelineSpecOptions } from "../domain/pipeline-spec.types";
import type { Job } from "../domain/job.types";
import type { IJobRepository } from "../ports/job-repository.port";
import type { IStudioBridge } from "../ports/studio-bridge.port";

export class ApplyPipelineSpecUseCase {
  constructor(
    private readonly jobRepository: IJobRepository,
    private readonly studioBridge: IStudioBridge,
  ) {}

  async execute(options: ApplyPipelineSpecOptions): Promise<Job> {
    const { jobId, spec, overwrite = false } = options;
    const job = await this.jobRepository.findById(jobId);

    if (!job && !overwrite) {
      throw new Error(`Job ${jobId} not found`);
    }

    const response = await this.studioBridge.executeCommand({
      action: "apply-pipeline",
      jobId,
      payload: { spec, overwrite },
    });

    if (!response.success) {
      throw new Error(response.error ?? "Failed to apply pipeline spec");
    }

    if (job) {
      return await this.jobRepository.update(job);
    }

    throw new Error("Job not found after apply");
  }
}