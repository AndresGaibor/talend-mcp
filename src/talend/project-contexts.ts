import { readTextFile } from "./files";
import { listJobs } from "./repository";
import { asArray, parseXml } from "./xml";
import type { TalendContextParameter } from "./types";

type XmlRecord = Record<string, unknown>;

export type ProjectContext = {
  jobName: string;
  version: string;
  folderPath?: string;
  itemPath: string;
  contextName: string;
  parameters: TalendContextParameter[];
};

function attr(nodo: XmlRecord | undefined, nombre: string): string | undefined {
  const valor = nodo?.[`@_${nombre}`];
  return typeof valor === "string" ? valor : undefined;
}

function parseContextParameters(context: XmlRecord): TalendContextParameter[] {
  return asArray(context.contextParameter as XmlRecord | XmlRecord[] | undefined).map((parameter) => ({
    name: attr(parameter, "name") ?? "",
    type: attr(parameter, "type"),
    value: attr(parameter, "value"),
    prompt: attr(parameter, "prompt"),
  }));
}

function parseProjectJobContexts(xml: string): { contextName: string; parameters: TalendContextParameter[] }[] {
  const parsed = parseXml(xml) as Record<string, XmlRecord>;
  const root = parsed["talendfile:ProcessType"] ?? parsed.ProcessType;
  if (!root) throw new Error("XML de job Talend inválido: falta talendfile:ProcessType");

  return asArray(root.context as XmlRecord | XmlRecord[] | undefined).map((context) => ({
    contextName: attr(context, "name") ?? "",
    parameters: parseContextParameters(context),
  }));
}

export async function listProjectContexts(projectPath: string): Promise<ProjectContext[]> {
  const jobs = await listJobs(projectPath);
  const contexts: ProjectContext[] = [];

  for (const job of jobs) {
    const xml = await readTextFile(job.itemPath, projectPath);
    for (const context of parseProjectJobContexts(xml)) {
      contexts.push({
        jobName: job.label,
        version: job.version,
        folderPath: job.folderPath,
        itemPath: job.itemPath,
        contextName: context.contextName,
        parameters: context.parameters,
      });
    }
  }

  return contexts;
}

export function formatProjectContexts(contexts: ProjectContext[]): string {
  if (contexts.length === 0) return "No se encontraron contextos.";

  const lines: string[] = [];

  for (const context of contexts) {
    const scope = context.folderPath ? `${context.jobName} [${context.folderPath}]` : context.jobName;
    lines.push(`${scope} :: ${context.contextName} (${context.parameters.length} variables)`);
    for (const parameter of context.parameters) {
      lines.push(`  - ${parameter.name} = ${parameter.value ?? ""}${parameter.type ? ` (${parameter.type})` : ""}`);
    }
  }

  return lines.join("\n");
}
