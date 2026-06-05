import { basename, dirname, join } from "node:path";
import { parseXml } from "../../xml/xml-utils";
import { readTextFile, listFilesRecursive } from "../../filesystem/file-reader";
import { splitPortable } from "../../../platform/path-bridge";
import type { TalendJobResource } from "../../../domain/job/job.entity";

export function parseJobProperties(xml: string, propertiesPath: string): TalendJobResource {
  const parsed = parseXml(xml) as Record<string, unknown>;
  const root = parsed["xmi:XMI"] as Record<string, unknown> | undefined;
  const property = root?.["TalendProperties:Property"] as Record<string, string> | undefined;
  const processItem = root?.["TalendProperties:ProcessItem"] as Record<string, unknown> | undefined;
  const itemState = root?.["TalendProperties:ItemState"] as Record<string, string> | undefined;
  const process = processItem?.process as Record<string, string> | undefined;
  const href = process?.["@_href"] ?? "";
  const itemFile = href.split("#")[0] ?? "";
  const folderPath = itemState?.["@_path"] ?? "";

  return {
    label: property?.["@_label"] ?? "",
    version: property?.["@_version"] ?? "",
    folderPath: folderPath || undefined,
    purpose: property?.["@_purpose"],
    description: property?.["@_description"],
    itemPath: join(dirname(propertiesPath), itemFile),
    propertiesPath,
  };
}

export async function listTalendJobs(projectPath: string): Promise<TalendJobResource[]> {
  const processPath = join(projectPath, "process");
  const propertiesFiles = await listFilesRecursive(processPath, (ruta) => ruta.endsWith(".properties"));
  const jobs: TalendJobResource[] = [];

  for (const propertiesPath of propertiesFiles) {
    const xml = await readTextFile(propertiesPath, projectPath);
    const job = parseJobProperties(xml, propertiesPath);
    if (job.label && job.itemPath.endsWith(".item")) jobs.push(job);
  }

  return jobs;
}

export function createEmptyJobItemXml(jobName: string, version: string, defaultContext = "Default"): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<talendfile:ProcessType defaultContext="${defaultContext}" jobType="Standard">
  <context name="${defaultContext}"/>
</talendfile:ProcessType>`;
}

export function createEmptyJobPropertiesXml(options: { label: string; version: string; itemFileName: string; folderPath?: string }): string {
  const folderPath = normalizeFolderPath(options.folderPath) ?? "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<xmi:XMI>
  <TalendProperties:Property label="${options.label}" version="${options.version}" displayName="${options.label}"/>
  <TalendProperties:ItemState path="${folderPath}"/>
  <TalendProperties:ProcessItem>
    <process href="${options.itemFileName}#/"/>
  </TalendProperties:ProcessItem>
</xmi:XMI>`;
}

export function getJobVersion(itemPath: string): string {
  const match = itemPath.match(/_(\d+\.\d+)\.item$/);
  return match?.[1] ?? "0.1";
}

export function normalizeFolderPath(folderPath?: string): string | undefined {
  const normalized = folderPath?.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "").trim();
  if (!normalized) return undefined;

  const parts = splitPortable(normalized);
  if (parts.some((part) => part === ".." || part === "." || part === "")) {
    throw new Error(`Ruta de carpeta inválida: ${folderPath}`);
  }

  return normalized;
}
