import { basename } from "node:path";
import { asArray, parseXml } from "./xml";
import type { LaunchConfig, OpenJob } from "./types";

type XmlNode = Record<string, unknown>;

function walk(valor: unknown, visitar: (nodo: XmlNode) => void): void {
  if (Array.isArray(valor)) {
    for (const item of valor) walk(item, visitar);
    return;
  }

  if (!valor || typeof valor !== "object") return;
  const nodo = valor as XmlNode;
  visitar(nodo);

  for (const hijo of Object.values(nodo)) {
    walk(hijo, visitar);
  }
}

export function parseOpenJobsFromWorkbench(xml: string, workbenchPath: string): OpenJob[] {
  const parsed = parseXml(xml);
  const jobs: OpenJob[] = [];

  walk(parsed, (nodo) => {
    const label = typeof nodo["@_label"] === "string" ? nodo["@_label"] : undefined;
    if (!label?.startsWith("Job ")) return;

    const match = /^Job\s+(.+)\s+(\d+(?:\.\d+)*)$/.exec(label);
    if (!match) return;

    jobs.push({
      jobName: match[1] ?? "",
      version: match[2] ?? "",
      label,
      workbenchPath,
      selected: true,
    });
  });

  return jobs;
}

export function parseLaunchConfig(xml: string, path: string): LaunchConfig {
  const parsed = parseXml(xml) as {
    launchConfiguration?: { stringAttribute?: Array<Record<string, string>> | Record<string, string> };
  };
  const atributos = asArray(parsed.launchConfiguration?.stringAttribute);
  const valores = new Map<string, string>();

  for (const atributo of atributos) {
    const key = atributo["@_key"];
    const value = atributo["@_value"];
    if (typeof key === "string" && typeof value === "string") valores.set(key, value);
  }

  return {
    currentProjectName: valores.get("CURRENT_PROJECT_NAME"),
    jobProjectTechLabel: valores.get("JOB_PROJECT_TECH_LABEL"),
    jobId: valores.get("TALEND_JOB_ID"),
    jobName: valores.get("TALEND_JOB_NAME") ?? basename(path).replace(/\s+\d+(?:\.\d+)*\.launch$/, ""),
    jobVersion: valores.get("TALEND_JOB_VERSION"),
    path,
  };
}