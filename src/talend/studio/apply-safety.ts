import { existsSync, realpathSync, unlinkSync, writeFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";

export type NewJobTarget = { jobDir: string; itemPath: string; propertiesPath: string };

function inside(path: string, root: string): boolean {
  const rel = relative(root, path);
  return rel === "" || (!rel.startsWith(`..${sep}`) && rel !== ".." && !isAbsolute(rel));
}

export function resolveNewJobTarget(
  projectPath: string,
  jobName: string,
  version: string,
  folderPath: string,
  existingJobNames: string[],
): NewJobTarget {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(jobName)) throw new Error("jobName contains unsupported characters");
  if (!/^\d+(?:\.\d+)*$/.test(version)) throw new Error("version contains unsupported characters");
  const folderParts = folderPath.replace(/\\/g, "/").split("/").filter(Boolean);
  if (!folderParts.length || folderParts[0]!.toLowerCase() !== "process") {
    throw new Error("folderPath must be inside Process/");
  }
  const childFolders = folderParts.slice(1);
  if (childFolders.some((part) => part === "." || part === ".." || !/^[\w .-]+$/.test(part))) {
    throw new Error("folderPath contains unsupported path segments");
  }
  if (existingJobNames.some((name) => name.toLowerCase() === jobName.toLowerCase())) {
    throw new Error(`Job ${jobName} already exists`);
  }

  const projectRoot = resolve(projectPath);
  const processRoot = resolve(projectRoot, "process");
  const jobDir = resolve(processRoot, ...childFolders);
  if (!inside(jobDir, processRoot)) throw new Error("folderPath escapes the Talend process directory");

  // Resolve any existing portion so a symlink under process/ cannot redirect writes.
  const actualProjectRoot = existsSync(projectRoot) ? realpathSync(projectRoot) : projectRoot;
  const actualProcessRoot = existsSync(processRoot) ? realpathSync(processRoot) : processRoot;
  if (existsSync(processRoot) && !inside(actualProcessRoot, actualProjectRoot)) {
    throw new Error("Talend process directory resolves outside the project");
  }
  let existing = jobDir;
  while (!existsSync(existing) && existing !== processRoot) existing = resolve(existing, "..");
  if (existsSync(existing)) {
    const actual = realpathSync(existing);
    if (existsSync(processRoot) && !inside(actual, actualProcessRoot)) {
      throw new Error("folderPath resolves outside the Talend process directory");
    }
  }

  const itemPath = join(jobDir, `${jobName}_${version}.item`);
  const propertiesPath = join(jobDir, `${jobName}_${version}.properties`);
  if (existsSync(itemPath) || existsSync(propertiesPath)) {
    throw new Error(`Job ${jobName} already exists at the destination`);
  }
  return { jobDir, itemPath, propertiesPath };
}

export function writeNewJobFiles(target: NewJobTarget, itemXml: string, propertiesXml: string): void {
  let itemCreated = false;
  try {
    writeFileSync(target.itemPath, itemXml, { flag: "wx" });
    itemCreated = true;
    writeFileSync(target.propertiesPath, propertiesXml, { flag: "wx" });
  } catch (error) {
    if (itemCreated) unlinkSync(target.itemPath);
    throw error;
  }
}
