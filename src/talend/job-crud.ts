import { mkdirSync, rmSync } from "node:fs";
import { basename, join } from "node:path";
import { readTextFile, writeTextFile } from "./files";
import { listJobs } from "./repository";
import type { TalendJobResource } from "./types";
import { buildJobletItemXml, buildJobletPropertiesXml } from "./job-generator";

export interface CreateJobOptions {
  jobName: string;
  version: string;
  defaultContext?: string;
  label?: string;
  description?: string;
  purpose?: string;
  folderPath?: string;
}

export interface RenameJobOptions {
  oldJobName: string;
  newJobName: string;
  folderPath?: string;
}

export interface DuplicateJobOptions {
  sourceJobName: string;
  sourceFolderPath?: string;
  targetJobName: string;
  targetVersion?: string;
  targetFolderPath?: string;
}

export interface MoveJobOptions {
  jobName: string;
  folderPath: string;
}

function normalizeFolderPath(folderPath?: string): string | undefined {
  const normalized = folderPath?.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "").trim();
  if (!normalized) return undefined;

  const parts = normalized.split("/");
  if (parts.some((part) => part === ".." || part === "." || part === "")) {
    throw new Error(`Ruta de carpeta inválida: ${folderPath}`);
  }

  return normalized;
}

function processDir(projectPath: string): string {
  return join(projectPath, "process");
}

function resolveFolderDir(projectPath: string, folderPath?: string): string {
  const normalized = normalizeFolderPath(folderPath);
  return normalized ? join(processDir(projectPath), ...normalized.split("/")) : processDir(projectPath);
}

function resolveFolderState(folderPath?: string): string {
  return normalizeFolderPath(folderPath) ?? "";
}

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

export function createEmptyJobItemXml(options: { jobName: string; version: string; defaultContext?: string }): string {
  const ctx = options.defaultContext ?? "Default";
  return `<?xml version="1.0" encoding="UTF-8"?>
<talendfile:ProcessType defaultContext="${ctx}" jobType="Standard">
  <context name="${ctx}"/>
</talendfile:ProcessType>`;
}

export function createEmptyJobPropertiesXml(options: { label: string; version: string; itemFileName: string; folderPath?: string; description?: string; purpose?: string }): string {
  const folderPath = resolveFolderState(options.folderPath);
  return `<?xml version="1.0" encoding="UTF-8"?>
<xmi:XMI>
  <TalendProperties:Property label="${options.label}" version="${options.version}" displayName="${options.label}"${options.description !== undefined ? ` description="${options.description}"` : ""}${options.purpose !== undefined ? ` purpose="${options.purpose}"` : ""}/>
  <TalendProperties:ItemState path="${folderPath}"/>
  <TalendProperties:ProcessItem>
    <process href="${options.itemFileName}#/"/>
  </TalendProperties:ProcessItem>
</xmi:XMI>`;
}

export function createTalendFolder(projectPath: string, folderPath: string): { folderPath: string; directoryPath: string } {
  const normalized = normalizeFolderPath(folderPath);
  if (!normalized) throw new Error("Ruta de carpeta inválida.");

  const directoryPath = resolveFolderDir(projectPath, normalized);
  mkdirSync(directoryPath, { recursive: true });

  return { folderPath: normalized, directoryPath };
}

export async function createTalendJob(
  projectPath: string,
  options: CreateJobOptions,
): Promise<{ itemPath: string; propertiesPath: string }> {
  const version = options.version ?? "0.1";
  const jobName = options.jobName;
  const folderPath = normalizeFolderPath(options.folderPath);
  const itemFileName = `${jobName}_${version}.item`;
  const propertiesFileName = `${jobName}_${version}.properties`;
  const jobDir = resolveFolderDir(projectPath, folderPath);

  const itemXml = createEmptyJobItemXml({ jobName, version, defaultContext: options.defaultContext ?? "Default" });
  const propertiesXml = createEmptyJobPropertiesXml({ label: options.label ?? jobName, version, itemFileName, folderPath, description: options.description, purpose: options.purpose });

  const itemPath = join(jobDir, itemFileName);
  const propertiesPath = join(jobDir, propertiesFileName);

  await writeTextFile(itemPath, itemXml, projectPath);
  await writeTextFile(propertiesPath, propertiesXml, projectPath);

  return { itemPath, propertiesPath };
}

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

export async function deleteTalendJob(
  projectPath: string,
  options: { jobName: string; folderPath?: string },
): Promise<{ itemPath: string; propertiesPath: string }> {
  const source = await findTalendJob(projectPath, options.jobName, options.folderPath);

  return { itemPath: source.itemPath, propertiesPath: source.propertiesPath };
}

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

function jobletsDir(projectPath: string): string {
  return join(projectPath, "joblets");
}

function resolveJobletFolderDir(projectPath: string, folderPath?: string): string {
  const normalized = normalizeFolderPath(folderPath);
  return normalized ? join(jobletsDir(projectPath), ...normalized.split("/")) : jobletsDir(projectPath);
}

export interface CreateJobletOptions {
  jobletName: string;
  version: string;
  defaultContext?: string;
  label?: string;
  description?: string;
  purpose?: string;
  folderPath?: string;
}

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
