import { existsSync, rmSync } from "node:fs";
import { resolveContextFiles } from "./xml-helpers";

export async function deleteRepositoryContext(
  projectPath: string,
  contextName: string,
): Promise<{ itemPath: string; propertiesPath: string }> {
  const { itemPath, propertiesPath } = resolveContextFiles(projectPath, contextName);
  if (existsSync(itemPath)) rmSync(itemPath, { force: true });
  if (existsSync(propertiesPath)) rmSync(propertiesPath, { force: true });
  return { itemPath, propertiesPath };
}
