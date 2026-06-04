import { basename } from "node:path";
import { XMLBuilder, XMLParser } from "fast-xml-parser";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  allowBooleanAttributes: true,
  parseAttributeValue: false,
  trimValues: false,
});

const builder = new XMLBuilder({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  format: true,
  suppressEmptyNode: false,
  suppressBooleanAttributes: false,
});

export function parseXml(xml: string): unknown {
  return parser.parse(xml);
}

export function buildXml(data: unknown): string {
  return builder.build(data);
}

export function asArray<T>(valor: T | T[] | undefined | null): T[] {
  if (valor === undefined || valor === null) return [];
  return Array.isArray(valor) ? valor : [valor];
}

export function parseLaunchConfig(xml: string, path: string): {
  currentProjectName?: string;
  jobProjectTechLabel?: string;
  jobId?: string;
  jobName?: string;
  jobVersion?: string;
  path: string;
} {
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