import { rmSync } from "node:fs";
import { join } from "node:path";
import { readTextFile, writeTextFile } from "../files";
import { findTalendJob } from "./find";
import { resolveFolderDir } from "./paths";
import type { RenameJobOptions } from "./types";

export async function renameTalendJob(
  projectPath: string,
  options: RenameJobOptions,
): Promise<{ oldItemPath: string; oldPropertiesPath: string; newItemPath: string; newPropertiesPath: string }> {
  const source = await findTalendJob(projectPath, options.oldJobName, options.folderPath);
  const oldItemXml = await readTextFile(source.itemPath, projectPath);
  const oldPropertiesXml = await readTextFile(source.propertiesPath, projectPath);
  const version = source.version || source.propertiesPath.match(/_(\d+\.\d+)\.properties$/)?.[1] || "0.1";
  const newItemFileName = `${options.newJobName}_${version}.item`;
  const newPropertiesFileName = `${options.newJobName}_${version}.properties`;
  const jobDir = resolveFolderDir(projectPath, source.folderPath);
  const newItemPath = join(jobDir, newItemFileName);
  const newPropertiesPath = join(jobDir, newPropertiesFileName);
  const newPropertiesXml = oldPropertiesXml
    .replace(/label="[^"]*"/g, `label="${options.newJobName}"`)
    .replace(/displayName="[^"]*"/g, `displayName="${options.newJobName}"`)
    .replace(/href="[^"]*\.item"/g, `href="${newItemFileName}"`);

  await writeTextFile(newItemPath, oldItemXml, projectPath);
  await writeTextFile(newPropertiesPath, newPropertiesXml, projectPath);

  if (newItemPath !== source.itemPath) rmSync(source.itemPath, { force: true });
  if (newPropertiesPath !== source.propertiesPath) rmSync(source.propertiesPath, { force: true });

  return { oldItemPath: source.itemPath, oldPropertiesPath: source.propertiesPath, newItemPath, newPropertiesPath };
}
