import { join } from "node:path";
import { splitPortable } from "../../../platform/path-bridge";
import { normalizeFolderPath, listTalendJobs } from "./job-properties-xml";

export function resolveFolderDir(projectPath: string, folderPath?: string): string {
  const normalized = normalizeFolderPath(folderPath);
  return normalized ? join(projectPath, "process", ...splitPortable(normalized)) : join(projectPath, "process");
}

export async function findTalendJob(projectPath: string, jobName: string, folderPath?: string) {
  const normalizedFolder = normalizeFolderPath(folderPath);
  const jobs = await listTalendJobs(projectPath);
  const matches = jobs.filter((job) => job.label === jobName && (normalizedFolder === undefined || normalizeFolderPath(job.folderPath) === normalizedFolder));

  if (matches.length === 0) {
    throw new Error(`Job no encontrado: ${jobName}`);
  }

  if (matches.length > 1) {
    throw new Error(`Job ambiguo: ${jobName}`);
  }

  return matches[0]!;
}
