import { readTextFile, writeTextFile } from "../files";
import { resolveContextFiles } from "./xml-helpers";
import { deleteItemXmlParameter, updateItemXmlParameter } from "./item-xml";

export async function updateRepositoryContextParameter(
  projectPath: string,
  contextName: string,
  parameterName: string,
  value: string,
  contextName_param: string = "Default",
  type?: string,
  prompt?: string,
): Promise<void> {
  const { itemPath } = resolveContextFiles(projectPath, contextName);
  const xml = await readTextFile(itemPath, projectPath);
  const updated = updateItemXmlParameter(xml, { contextName: contextName_param, parameterName, value, type, prompt }, "update");
  await writeTextFile(itemPath, updated, projectPath);
}

export async function upsertRepositoryContextParameter(
  projectPath: string,
  contextName: string,
  parameterName: string,
  value: string,
  contextName_param: string = "Default",
  type?: string,
  prompt?: string,
): Promise<void> {
  const { itemPath } = resolveContextFiles(projectPath, contextName);
  const xml = await readTextFile(itemPath, projectPath);
  const updated = updateItemXmlParameter(xml, { contextName: contextName_param, parameterName, value, type, prompt }, "upsert");
  await writeTextFile(itemPath, updated, projectPath);
}

export async function deleteRepositoryContextParameter(
  projectPath: string,
  contextName: string,
  parameterName: string,
  contextName_param: string = "Default",
): Promise<void> {
  const { itemPath } = resolveContextFiles(projectPath, contextName);
  const xml = await readTextFile(itemPath, projectPath);
  const updated = deleteItemXmlParameter(xml, { contextName: contextName_param, parameterName });
  await writeTextFile(itemPath, updated, projectPath);
}
