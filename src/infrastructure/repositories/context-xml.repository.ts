import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { listFilesRecursive, readTextFile } from "../filesystem/file-reader";
import { parseXml, asArray } from "../xml/xml-utils";
import { getDirNamePortable, getBaseNamePortable } from "../../platform/path-bridge";

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
      const relativePath = itemPath.replace(projectPath, "").replace(/\\/g, "/");
      const folderPath = getDirNamePortable(relativePath).split("/").filter(Boolean).pop() ?? "";

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

/** Un contexto del proyecto (un item de tipo Contexts) con sus entornos. */
export type RepositoryContextItem = {
  name: string;
  version: string;
  itemPath: string;
  contexts: {
    contextName: string;
    parameters: TalendContextParameter[];
  }[];
};

/**
 * Los contextos del proyecto: los items de la carpeta `context`.
 *
 * Cada item tiene un `.item` con un `ContextType` por entorno, y dentro los
 * `contextParameter` con su tipo y su valor.
 */
export async function listRepositoryContextItems(projectPath: string): Promise<RepositoryContextItem[]> {
  const root = join(projectPath, "context");
  if (!existsSync(root)) return [];

  const items: RepositoryContextItem[] = [];
  const candidates: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      for (const inner of readdirSync(join(root, entry.name), { withFileTypes: true })) {
        if (inner.isFile() && inner.name.endsWith(".item")) {
          candidates.push(join(root, entry.name, inner.name));
        }
      }
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".item")) {
      candidates.push(join(root, entry.name));
    }
  }

  for (const itemPath of candidates) {
    try {
      const xml = await readTextFile(itemPath, projectPath);
      const parsed = parseXml(xml) as Record<string, XmlRecord>;
      const contexts = asArray(parsed["talendfile:ContextType"] ?? parsed.ContextType).map(
        (context: unknown) => {
          const record = context as XmlRecord;
          return {
            contextName: attr(record, "name") ?? "Default",
            parameters: asArray(record.contextParameter as XmlRecord | XmlRecord[] | undefined).map(
              (parameter: XmlRecord) => ({
                name: attr(parameter, "name") ?? "",
                type: attr(parameter, "type"),
                value: attr(parameter, "value"),
                prompt: attr(parameter, "prompt"),
              }),
            ),
          };
        },
      );
      const base = getBaseNamePortable(itemPath).replace(/\.item$/, "");
      // La etiqueta puede llevar guion bajo: el version va despues del ultimo.
      const cut = base.lastIndexOf("_");
      const name = cut > 0 ? base.slice(0, cut) : base;
      const version = cut > 0 ? base.slice(cut + 1) : "0.1";
      items.push({ name, version, itemPath, contexts });
    } catch {
      continue;
    }
  }

  return items;
}