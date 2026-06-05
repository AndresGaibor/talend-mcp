import type { TalendJobResource } from "../../../talend/types";

export interface IJobRepository {
  listJobs(projectPath: string): Promise<TalendJobResource[]>;
  findJobByName(projectPath: string, jobName: string): Promise<TalendJobResource | null>;
}
