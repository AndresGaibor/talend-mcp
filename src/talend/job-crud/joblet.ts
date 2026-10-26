import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { writeTextFile } from "../files";
import { buildJobletItemXml, buildJobletPropertiesXml } from "../job-generator/joblet";
import { normalizeFolderPath, resolveJobletFolderDir } from "./paths";
import type { CreateJobletOptions } from "./types";

export async function createTalendJoblet(
  projectPath: string,
  options: CreateJobletOptions,
  jobletSpec: any
): Promise<{ itemPath: string; propertiesPath: string }> {
  const version = options.version ?? "0.1";
  const jobletName = options.jobletName;
  const folderPath = normalizeFolderPath(options.folderPath);
  const itemFileName = `${jobletName}_${version}.item`;
  const propertiesFileName = `${jobletName}_${version}.properties`;
  const targetDir = resolveJobletFolderDir(projectPath, folderPath);

  mkdirSync(targetDir, { recursive: true });

  const { xml: itemXml, rootId } = buildJobletItemXml(jobletSpec);
  const propertiesXml = buildJobletPropertiesXml(jobletSpec, rootId);

  const itemPath = join(targetDir, itemFileName);
  const propertiesPath = join(targetDir, propertiesFileName);

  await writeTextFile(itemPath, itemXml, projectPath);
  await writeTextFile(propertiesPath, propertiesXml, projectPath);

  return { itemPath, propertiesPath };
}
