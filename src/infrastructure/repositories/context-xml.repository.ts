import { listFilesRecursive, readTextFile } from "../filesystem/file-reader";
import { parseXml, asArray } from "../xml/xml-utils";

export interface TalendContextParameter {
  name: string;
  type?: string;
  value?: string;
  prompt?: string;
}

export type ProjectContext = {
  jobName: string;
  version: string;
  folderPath?: string;
  itemPath: string;
  contextName: string;
  parameters: TalendContextParameter[];
};

type XmlRecord = Record<string, unknown>;

function attr(nodo: XmlRecord | undefined, nombre: string): string | undefined {
  const valor = nodo?.[`@_${nombre}`];
  return typeof valor === "string" ? valor : undefined;
}

function parseContextParameters(context: XmlRecord): TalendContextParameter[] {
  return asArray(context.contextParameter as XmlRecord | XmlRecord[] | undefined).map((parameter: XmlRecord) => ({
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

  return asArray(root.context as XmlRecord | XmlRecord[] | undefined).map((context: XmlRecord) => ({
    contextName: attr(context, "name") ?? "",
    parameters: parseContextParameters(context),
  }));
}

export async function listProjectContexts(projectPath: string): Promise<ProjectContext[]> {
  const jobFiles = await listFilesRecursive(projectPath, (path) => path.endsWith(".item") && path.includes("process"));
  const contexts: ProjectContext[] = [];

  for (const itemPath of jobFiles) {
    try {
      const xml = await readTextFile(itemPath, projectPath);
      const parsed = parseXml(xml) as Record<string, XmlRecord>;
      const root = parsed["talendfile:ProcessType"] ?? parsed.ProcessType;
      if (!root) continue;

      const jobName = attr(root, "label") ?? "unknown";
      const version = attr(root, "version") ?? "0.1";
      const folderPath = itemPath.replace(projectPath, "").split("/").slice(-2, -1)[0];

      for (const context of parseProjectJobContexts(xml)) {
        contexts.push({
          jobName,
          version,
          folderPath,
          itemPath,
          contextName: context.contextName,
          parameters: context.parameters,
        });
      }
    } catch {
      continue;
    }
  }

  return contexts;
}