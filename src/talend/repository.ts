import { dirname, join } from "node:path";
import { listFilesRecursive, readTextFile } from "./files";
import { asArray, parseXml } from "./xml";
import type { TalendJobResource } from "./types";

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

export async function listJobs(projectPath: string): Promise<TalendJobResource[]> {
  const processPath = join(projectPath, "process");
  const propertiesFiles = await listFilesRecursive(processPath, (ruta) => ruta.endsWith(".properties"));
  const jobs: TalendJobResource[] = [];

  for (let i = 0; i < propertiesFiles.length; i += 32) {
    const batch = await Promise.all(propertiesFiles.slice(i, i + 32).map(async (propertiesPath) => {
      const xml = await readTextFile(propertiesPath, projectPath);
      const job = parseJobProperties(xml, propertiesPath);
      return job.label && job.itemPath.endsWith(".item") ? job : null;
    }));
    jobs.push(...batch.filter((job): job is TalendJobResource => job !== null));
  }

  return jobs;
}
