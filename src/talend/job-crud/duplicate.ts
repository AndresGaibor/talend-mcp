import { join } from "node:path";
import { readTextFile, writeTextFile } from "../files";
import { findTalendJob } from "./find";
import { normalizeFolderPath, resolveFolderDir, resolveFolderState } from "./paths";
import type { DuplicateJobOptions } from "./types";

export async function duplicateTalendJob(
  projectPath: string,
  options: DuplicateJobOptions,
): Promise<{ itemPath: string; propertiesPath: string }> {
  const source = await findTalendJob(projectPath, options.sourceJobName, options.sourceFolderPath);
  const version = options.targetVersion ?? source.version ?? (source.propertiesPath.match(/_(\d+\.\d+)\.properties$/)?.[1] || "0.1");
  const targetFolderPath = normalizeFolderPath(options.targetFolderPath) ?? normalizeFolderPath(source.folderPath);
  const newItemFileName = `${options.targetJobName}_${version}.item`;
  const newPropertiesFileName = `${options.targetJobName}_${version}.properties`;
  const jobDir = resolveFolderDir(projectPath, targetFolderPath);

  const oldItemXml = await readTextFile(source.itemPath, projectPath);
  const oldPropertiesXml = await readTextFile(source.propertiesPath, projectPath);
  const newItemPath = join(jobDir, newItemFileName);
  const newPropertiesPath = join(jobDir, newPropertiesFileName);
  const newPropertiesXml = oldPropertiesXml
    .replace(/label="[^"]*"/g, `label="${options.targetJobName}"`)
    .replace(/displayName="[^"]*"/g, `displayName="${options.targetJobName}"`)
    .replace(/href="[^"]*\.item"/g, `href="${newItemFileName}"`)
    .replace(/(<TalendProperties:ItemState[^>]*\spath=")[^"]*(")/, `$1${resolveFolderState(targetFolderPath)}$2`);

  await writeTextFile(newItemPath, oldItemXml, projectPath);
  await writeTextFile(newPropertiesPath, newPropertiesXml, projectPath);

  return { itemPath: newItemPath, propertiesPath: newPropertiesPath };
}
