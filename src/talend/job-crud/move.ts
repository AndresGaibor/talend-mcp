import { rmSync } from "node:fs";
import { basename, join } from "node:path";
import { readTextFile, writeTextFile } from "../files";
import { findTalendJob } from "./find";
import { normalizeFolderPath, resolveFolderDir, resolveFolderState } from "./paths";
import type { MoveJobOptions } from "./types";

export async function deleteTalendJob(
  projectPath: string,
  options: { jobName: string; folderPath?: string },
): Promise<{ itemPath: string; propertiesPath: string }> {
  const source = await findTalendJob(projectPath, options.jobName, options.folderPath);

  return { itemPath: source.itemPath, propertiesPath: source.propertiesPath };
}

export async function moveTalendJobToFolder(
  projectPath: string,
  options: MoveJobOptions,
): Promise<{ oldItemPath: string; oldPropertiesPath: string; newItemPath: string; newPropertiesPath: string }> {
  const source = await findTalendJob(projectPath, options.jobName);
  const targetFolderPath = normalizeFolderPath(options.folderPath);
  const jobDir = resolveFolderDir(projectPath, targetFolderPath);
  const itemFileName = basename(source.itemPath);
  const propertiesFileName = basename(source.propertiesPath);
  const newItemPath = join(jobDir, itemFileName);
  const newPropertiesPath = join(jobDir, propertiesFileName);

  if (newItemPath === source.itemPath && newPropertiesPath === source.propertiesPath) {
    return {
      oldItemPath: source.itemPath,
      oldPropertiesPath: source.propertiesPath,
      newItemPath,
      newPropertiesPath,
    };
  }

  const oldItemXml = await readTextFile(source.itemPath, projectPath);
  const oldPropertiesXml = await readTextFile(source.propertiesPath, projectPath);
  const newPropertiesXml = oldPropertiesXml.replace(/(<TalendProperties:ItemState[^>]*\spath=")[^"]*(")/, `$1${resolveFolderState(targetFolderPath)}$2`);

  await writeTextFile(newItemPath, oldItemXml, projectPath);
  await writeTextFile(newPropertiesPath, newPropertiesXml, projectPath);

  rmSync(source.itemPath, { force: true });
  rmSync(source.propertiesPath, { force: true });

  return {
    oldItemPath: source.itemPath,
    oldPropertiesPath: source.propertiesPath,
    newItemPath,
    newPropertiesPath,
  };
}
