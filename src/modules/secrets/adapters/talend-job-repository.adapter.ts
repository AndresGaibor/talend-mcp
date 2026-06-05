import { listJobs } from "../../../talend/repository";
import type { TalendJobResource } from "../../../talend/types";
import type { IJobRepository } from "../ports/job-repository.port";

export class TalendJobRepositoryAdapter implements IJobRepository {
  async listJobs(projectPath: string): Promise<TalendJobResource[]> {
    return listJobs(projectPath);
  }

  async findJobByName(projectPath: string, jobName: string): Promise<TalendJobResource | null> {
    const jobs = await this.listJobs(projectPath);
    return jobs.find((job) => job.label === jobName) ?? null;
  }
}
