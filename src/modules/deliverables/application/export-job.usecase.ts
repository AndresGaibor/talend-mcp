import type { ExportJob, ExportJobOptions } from "../domain/deliverable.types";

export class ExportJobUseCase {
  private readonly jobs = new Map<string, ExportJob>();

  async execute(options: ExportJobOptions): Promise<ExportJob> {
    const job: ExportJob = {
      id: options.jobId,
      name: `Export ${options.packageId}`,
      status: "pending",
      startedAt: new Date(),
      destination: options.destination,
      packageId: options.packageId,
      progress: 0,
    };

    this.jobs.set(job.id, job);

    setTimeout(() => {
      this.updateJobProgress(job.id, 100);
    }, 100);

    return job;
  }

  private updateJobProgress(jobId: string, progress: number): void {
    const job = this.jobs.get(jobId);
    if (job) {
      job.progress = progress;
      job.status = progress >= 100 ? "completed" : "running";
      if (job.status === "completed") {
        job.completedAt = new Date();
      }
    }
  }
}