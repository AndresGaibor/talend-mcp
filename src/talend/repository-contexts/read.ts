import { existsSync } from "node:fs";
import { readTextFile } from "../files";
import { parseXml } from "../xml";
import type { RepositoryContext } from "./types";
import { contextDir, parseItemContexts, parseProperties, resolveContextFiles, type XmlRecord } from "./xml-helpers";

export async function listRepositoryContexts(projectPath: string): Promise<RepositoryContext[]> {
  const dir = contextDir(projectPath);
  if (!existsSync(dir)) return [];

  const contexts: RepositoryContext[] = [];
  const files = await import("node:fs").then((fs) => fs.promises.readdir(dir));
  const propertyFiles = files.filter((f) => f.endsWith("_0.1.properties"));

  for (const propFile of propertyFiles) {
    const contextName = propFile.replace("_0.1.properties", "");
    const { itemPath, propertiesPath } = resolveContextFiles(projectPath, contextName);

    try {
      const itemXml = await readTextFile(itemPath, projectPath);
      const propsXml = await readTextFile(propertiesPath, projectPath);
      const parsedProps = parseXml(propsXml) as Record<string, XmlRecord>;
      const meta = parseProperties(parsedProps);
      const contexts_data = parseItemContexts(itemXml);

      contexts.push({
        name: meta.label || contextName,
        version: meta.version,
        purpose: meta.purpose,
        description: meta.description,
        itemPath,
        propertiesPath,
        contexts: contexts_data,
      });
    } catch {
      // Skip invalid context files
    }
  }

  return contexts;
}

export async function readRepositoryContext(projectPath: string, contextName: string): Promise<RepositoryContext | null> {
  const { itemPath, propertiesPath } = resolveContextFiles(projectPath, contextName);
  if (!existsSync(itemPath) || !existsSync(propertiesPath)) return null;

  const itemXml = await readTextFile(itemPath, projectPath);
  const propsXml = await readTextFile(propertiesPath, projectPath);
  const parsedProps = parseXml(propsXml) as Record<string, XmlRecord>;
  const meta = parseProperties(parsedProps);
  const contexts_data = parseItemContexts(itemXml);

  return {
    name: meta.label || contextName,
    version: meta.version,
    purpose: meta.purpose,
    description: meta.description,
    itemPath,
    propertiesPath,
    contexts: contexts_data,
  };
}
