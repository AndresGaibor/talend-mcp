import { listJobs } from "../repository";
import type { TalendJobResource } from "../types";
import { normalizeFolderPath } from "./paths";

export async function findTalendJob(projectPath: string, jobName: string, folderPath?: string): Promise<TalendJobResource> {
  const normalizedFolder = normalizeFolderPath(folderPath);
  const jobs = await listJobs(projectPath);
  const matches = jobs.filter((job) => job.label === jobName && (normalizedFolder === undefined || normalizeFolderPath(job.folderPath) === normalizedFolder));

  if (matches.length === 0) {
    throw new Error(`Job no encontrado: ${jobName}`);
  }

  if (matches.length > 1) {
    throw new Error(`Job ambiguo: ${jobName}`);
  }

  return matches[0]!;
}
