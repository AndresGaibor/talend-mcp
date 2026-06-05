import { rmSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { readTextFile, writeTextFile } from "../filesystem/file-reader";
import type { IJobRepository, ParsedJob, JobSpec } from "../../domain/job/job.repository";
import type { TalendComponent } from "../../domain/job/job.entity";

import { parseXmlToJob } from "./job-xml/xml-parsers";
import { buildJobXml } from "./job-xml/xml-builders";
import { listTalendJobs, createEmptyJobItemXml, createEmptyJobPropertiesXml, getJobVersion } from "./job-xml/job-properties-xml";
import { normalizeFolderPath } from "./job-xml/job-properties-xml";
import { resolveFolderDir, findTalendJob } from "./job-xml/job-path-utils";

export class JobXmlRepository implements IJobRepository {
  async listJobs(projectPath: string): Promise<string[]> {
    const jobs = await listTalendJobs(projectPath);
    return jobs.map(job => job.itemPath);
  }

  async findJob(itemPath: string): Promise<string> {
    return await readTextFile(itemPath);
  }

  async createJob(projectPath: string, name: string, spec?: JobSpec): Promise<string> {
    const version = spec?.version ?? "0.1";
    const itemFileName = `${name}_${version}.item`;
    const propertiesFileName = `${name}_${version}.properties`;
    const jobDir = resolveFolderDir(projectPath, undefined);

    let itemXml: string;
    if (spec && spec.components && spec.components.length > 0) {
      const parsedJob = this.buildParsedJobFromSpec(spec, itemFileName, jobDir);
      itemXml = buildJobXml(parsedJob);
    } else {
      itemXml = createEmptyJobItemXml(name, version);
    }

    const propertiesXml = createEmptyJobPropertiesXml({
      label: name,
      version,
      itemFileName,
      folderPath: undefined,
    });

    const itemPath = join(jobDir, itemFileName);
    const propertiesPath = join(jobDir, propertiesFileName);

    await writeTextFile(itemPath, itemXml, projectPath);
    await writeTextFile(propertiesPath, propertiesXml, projectPath);

    return itemPath;
  }

  private buildParsedJobFromSpec(spec: JobSpec, itemFileName: string, jobDir: string): ParsedJob {
    const components = spec.components!.map((c) => {
      const schemas = c.schemas?.map((s) => ({
        name: s.name ?? "",
        connector: s.connector,
        label: s.name,
        columns: s.columns.map((col) => ({
          name: col.name,
          type: col.type,
          length: col.length,
          nullable: col.nullable,
        })),
      })) ?? [];
      return {
        uniqueName: c.uniqueName,
        componentName: c.componentName,
        label: c.label,
        nodeAttributes: {} as Record<string, string>,
        parameters: c.parameters ?? {},
        schemas,
        rawNodeData: undefined,
      };
    });

    const connections = (spec.connections ?? []).map((c) => ({
      source: c.source,
      target: c.target,
      label: c.label ?? "",
      metaname: c.metaname,
      uniqueName: undefined,
    }));

    const contexts = (spec.contextParameters ?? []).map((p) => ({
      name: p.name,
      type: p.type,
      value: p.value,
      prompt: p.prompt,
    }));

    return {
      itemPath: join(jobDir, itemFileName),
      components,
      connections,
      contexts,
      mapperEntries: [],
    };
  }

  async deleteJob(itemPath: string): Promise<void> {
    const propertiesPath = itemPath.replace(/\.item$/, ".properties");
    rmSync(itemPath, { force: true });
    rmSync(propertiesPath, { force: true });
  }

  async renameJob(itemPath: string, newName: string): Promise<string> {
    const projectPath = dirname(dirname(dirname(itemPath)));
    const jobName = basename(itemPath).replace(/_\d+\.\d+\.item$/, "");
    const itemNormalized = itemPath.replace(/\\/g, "/");
    const folderPath = itemNormalized.includes("/process/") ? itemNormalized.split("/process/")[1]?.replace(/\/[^/]+$/, "") : undefined;

    const source = await findTalendJob(projectPath, jobName, folderPath);
    const oldItemXml = await readTextFile(source.itemPath, projectPath);
    const oldPropertiesXml = await readTextFile(source.propertiesPath, projectPath);
    const version = getJobVersion(source.itemPath);
    const newItemFileName = `${newName}_${version}.item`;
    const newPropertiesFileName = `${newName}_${version}.properties`;
    const jobDir = resolveFolderDir(projectPath, source.folderPath);
    const newItemPath = join(jobDir, newItemFileName);
    const newPropertiesPath = join(jobDir, newPropertiesFileName);
    const newPropertiesXml = oldPropertiesXml
      .replace(/label="[^"]*"/g, `label="${newName}"`)
      .replace(/displayName="[^"]*"/g, `displayName="${newName}"`)
      .replace(/href="[^"]*\.item"/g, `href="${newItemFileName}"`);

    await writeTextFile(newItemPath, oldItemXml, projectPath);
    await writeTextFile(newPropertiesPath, newPropertiesXml, projectPath);

    if (newItemPath !== source.itemPath) rmSync(source.itemPath, { force: true });
    if (newPropertiesPath !== source.propertiesPath) rmSync(source.propertiesPath, { force: true });

    return newItemPath;
  }

  async duplicateJob(itemPath: string, newName: string): Promise<string> {
    const projectPath = dirname(dirname(dirname(itemPath)));
    const jobName = basename(itemPath).replace(/_\d+\.\d+\.item$/, "");
    const itemNormalized = itemPath.replace(/\\/g, "/");
    const folderPath = itemNormalized.includes("/process/") ? itemNormalized.split("/process/")[1]?.replace(/\/[^/]+$/, "") : undefined;

    const source = await findTalendJob(projectPath, jobName, folderPath);
    const version = getJobVersion(source.itemPath);
    const targetFolderPath = normalizeFolderPath(folderPath) ?? normalizeFolderPath(source.folderPath);
    const newItemFileName = `${newName}_${version}.item`;
    const newPropertiesFileName = `${newName}_${version}.properties`;
    const jobDir = resolveFolderDir(projectPath, targetFolderPath);

    const oldItemXml = await readTextFile(source.itemPath, projectPath);
    const oldPropertiesXml = await readTextFile(source.propertiesPath, projectPath);
    const newItemPath = join(jobDir, newItemFileName);
    const newPropertiesPath = join(jobDir, newPropertiesFileName);
    const newPropertiesXml = oldPropertiesXml
      .replace(/label="[^"]*"/g, `label="${newName}"`)
      .replace(/displayName="[^"]*"/g, `displayName="${newName}"`)
      .replace(/href="[^"]*\.item"/g, `href="${newItemFileName}"`)
      .replace(/(<TalendProperties:ItemState[^>]*\spath=")[^"]*(")/, `$1${targetFolderPath ?? ""}$2`);

    await writeTextFile(newItemPath, oldItemXml, projectPath);
    await writeTextFile(newPropertiesPath, newPropertiesXml, projectPath);

    return newItemPath;
  }

  async moveJob(itemPath: string, newFolderPath: string): Promise<string> {
    const projectPath = dirname(dirname(dirname(itemPath)));
    const jobName = basename(itemPath).replace(/_\d+\.\d+\.item$/, "");

    const source = await findTalendJob(projectPath, jobName);
    const targetFolderPath = normalizeFolderPath(newFolderPath);
    const jobDir = resolveFolderDir(projectPath, targetFolderPath);
    const itemFileName = basename(itemPath);
    const propertiesFileName = basename(source.propertiesPath);
    const newItemPath = join(jobDir, itemFileName);
    const newPropertiesPath = join(jobDir, propertiesFileName);

    if (newItemPath === source.itemPath && newPropertiesPath === source.propertiesPath) {
      return newItemPath;
    }

    const oldItemXml = await readTextFile(source.itemPath, projectPath);
    const oldPropertiesXml = await readTextFile(source.propertiesPath, projectPath);
    const newPropertiesXml = oldPropertiesXml.replace(/(<TalendProperties:ItemState[^>]*\spath=")[^"]*(")/, `$1${targetFolderPath ?? ""}$2`);

    await writeTextFile(newItemPath, oldItemXml, projectPath);
    await writeTextFile(newPropertiesPath, newPropertiesXml, projectPath);

    rmSync(source.itemPath, { force: true });
    rmSync(source.propertiesPath, { force: true });

    return newItemPath;
  }

  async parseJob(itemPath: string): Promise<ParsedJob> {
    const xml = await readTextFile(itemPath);
    return parseXmlToJob(xml, itemPath);
  }

  async writeJob(itemPath: string, job: ParsedJob): Promise<void> {
    const xml = buildJobXml(job);
    await writeTextFile(itemPath, xml);
  }

  async writeJobProperties(itemPath: string, properties: Record<string, string>): Promise<void> {
    const xml = await readTextFile(itemPath);
    let updatedXml = xml;
    for (const [key, value] of Object.entries(properties)) {
      const regex = new RegExp(`(@_${key}="[^"]*"|${key}="[^"]*")`, "g");
      if (updatedXml.includes(key)) {
        updatedXml = updatedXml.replace(regex, `${key}="${value}"`);
      }
    }
    await writeTextFile(itemPath, updatedXml);
  }
}
