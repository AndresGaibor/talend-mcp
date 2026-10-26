import { mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { readTextFile, writeTextFile } from "../files";
import { normalizeFolderPath, resolveFolderDir, xmlAttribute } from "./paths";
import type { CreateJobOptions } from "./types";

export function createEmptyJobItemXml(options: { jobName: string; version: string; defaultContext?: string }): string {
  const ctx = xmlAttribute(options.defaultContext ?? "Default");
  return `<?xml version="1.0" encoding="UTF-8"?>
<talendfile:ProcessType xmi:version="2.0" xmlns:xmi="http://www.omg.org/XMI" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:TalendMapper="http://www.talend.org/mapper" xmlns:talendfile="platform:/resource/org.talend.model/model/TalendFile.xsd" defaultContext="${ctx}" jobType="Standard">
  <context name="${ctx}"/>
</talendfile:ProcessType>`;
}

export function createEmptyJobPropertiesXml(options: { label: string; version: string; itemFileName: string; folderPath?: string; description?: string; purpose?: string; authorId?: string }): string {
  const label = xmlAttribute(options.label);
  const version = xmlAttribute(options.version);
  const itemFileName = xmlAttribute(options.itemFileName);
  const normalizedFolderPath = normalizeFolderPath(options.folderPath);
  const folderPath = xmlAttribute(normalizedFolderPath ?? "");
  const propertyXmiId = `_${randomUUID().replace(/-/g, "")}`;
  const propertyId = `_${randomUUID().replace(/-/g, "")}`;
  const itemId = `_${randomUUID().replace(/-/g, "")}`;
  const stateId = `_${randomUUID().replace(/-/g, "")}`;
  const authorHref = options.authorId
    ? `<author href="${"../".repeat((normalizedFolderPath?.split("/").length ?? 0) + 1)}talend.project#${xmlAttribute(options.authorId)}"/>`
    : "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<xmi:XMI xmi:version="2.0" xmlns:xmi="http://www.omg.org/XMI" xmlns:TalendProperties="http://www.talend.org/properties">
  <TalendProperties:Property xmi:id="${propertyXmiId}" id="${propertyId}" label="${label}" version="${version}" statusCode="" item="${itemId}" displayName="${label}"${options.description !== undefined ? ` description="${xmlAttribute(options.description)}"` : ""}${options.purpose !== undefined ? ` purpose="${xmlAttribute(options.purpose)}"` : ""}>
    ${authorHref}
  </TalendProperties:Property>
  <TalendProperties:ItemState xmi:id="${stateId}" path="${folderPath}"/>
  <TalendProperties:ProcessItem xmi:id="${itemId}" property="${propertyXmiId}" state="${stateId}">
    <process href="${itemFileName}#/"/>
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
  const projectXml = await readTextFile(join(projectPath, "talend.project"), projectPath).catch(() => "");
  const authorId = projectXml.match(/<TalendProperties:User\s+xmi:id="([^"]+)"/)?.[1];
  const propertiesXml = createEmptyJobPropertiesXml({ label: options.label ?? jobName, version, itemFileName, folderPath, description: options.description, purpose: options.purpose, authorId });

  const itemPath = join(jobDir, itemFileName);
  const propertiesPath = join(jobDir, propertiesFileName);

  await writeTextFile(itemPath, itemXml, projectPath);
  await writeTextFile(propertiesPath, propertiesXml, projectPath);

  return { itemPath, propertiesPath };
}
