import { join } from "node:path";
import { existsSync, mkdirSync } from "node:fs";
import { writeTextFile } from "../files";
import { generateTalendId } from "../utils";
import { contextDir } from "./xml-helpers";

export async function createRepositoryContext(
  projectPath: string,
  options: { name: string; version?: string; purpose?: string; description?: string },
): Promise<{ itemPath: string; propertiesPath: string }> {
  const dir = contextDir(projectPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const version = options.version ?? "0.1";
  const contextName = options.name;
  const itemFileName = `${contextName}_${version}.item`;
  const propertiesFileName = `${contextName}_${version}.properties`;
  const itemPath = join(dir, itemFileName);
  const propertiesPath = join(dir, propertiesFileName);

  const contextTypeId = generateTalendId();
  const propertyId = generateTalendId();
  const contextItemId = generateTalendId();
  const stateId = generateTalendId();
  const paramId = generateTalendId();

  const itemXml = `<?xml version="1.0" encoding="UTF-8"?>
<talendfile:ContextType xmi:version="2.0" xmlns:xmi="http://www.omg.org/XMI" xmlns:talendfile="platform:/resource/org.talend.model/model/TalendFile.xsd" xmi:id="${contextTypeId}" confirmationNeeded="false" hide="false" name="Default">
  <contextParameter xmi:id="${paramId}" comment="" name="example_param" prompt="example_param?" promptNeeded="false" repositoryContextId="built-in" type="id_String" value=""/>
</talendfile:ContextType>`;

  const propsXml = `<?xml version="1.0" encoding="UTF-8"?>
<xmi:XMI xmi:version="2.0" xmlns:xmi="http://www.omg.org/XMI" xmlns:TalendProperties="http://www.talend.org/properties">
  <TalendProperties:Property xmi:id="${generateTalendId()}" id="${propertyId}" label="${contextName}" purpose="${options.purpose ?? ""}" description="${options.description ?? ""}" version="${version}" item="${contextItemId}" displayName="${contextName}"/>
  <TalendProperties:ItemState xmi:id="${stateId}" path=""/>
  <TalendProperties:ContextItem xmi:id="${contextItemId}" property="${generateTalendId()}" state="${stateId}" defaultContext="Default">
    <context href="${itemFileName}#${contextTypeId}"/>
  </TalendProperties:ContextItem>
</xmi:XMI>`;

  await writeTextFile(itemPath, itemXml, projectPath);
  await writeTextFile(propertiesPath, propsXml, projectPath);

  return { itemPath, propertiesPath };
}
