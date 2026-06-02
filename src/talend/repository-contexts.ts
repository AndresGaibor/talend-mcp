import { join } from "node:path";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { readTextFile, writeTextFile } from "./files";
import { asArray, parseXml, buildXml } from "./xml";
import { generateTalendId } from "./utils";
import type { TalendContextParameter } from "./types";

type XmlRecord = Record<string, unknown>;

export type RepositoryContextParameter = {
  name: string;
  type?: string;
  value?: string;
  prompt?: string;
};

export type RepositoryContextContext = {
  contextName: string;
  parameters: RepositoryContextParameter[];
};

export type RepositoryContext = {
  name: string;
  version: string;
  purpose?: string;
  description?: string;
  itemPath: string;
  propertiesPath: string;
  contexts: RepositoryContextContext[];
};

function attr(nodo: XmlRecord | undefined, nombre: string): string | undefined {
  const valor = nodo?.[`@_${nombre}`];
  return typeof valor === "string" ? valor : undefined;
}

function contextDir(projectPath: string): string {
  return join(projectPath, "context");
}

function resolveContextFiles(projectPath: string, contextName: string): { itemPath: string; propertiesPath: string } {
  const dir = contextDir(projectPath);
  const itemPath = join(dir, `${contextName}_0.1.item`);
  const propertiesPath = join(dir, `${contextName}_0.1.properties`);
  return { itemPath, propertiesPath };
}

function parseItemParameters(context: XmlRecord): TalendContextParameter[] {
  return asArray(context.contextParameter as XmlRecord | XmlRecord[] | undefined).map((parameter) => ({
    name: attr(parameter, "name") ?? "",
    type: attr(parameter, "type"),
    value: attr(parameter, "value"),
    prompt: attr(parameter, "prompt"),
  }));
}

function parseItemContexts(xml: string): RepositoryContextContext[] {
  const parsed = parseXml(xml) as Record<string, XmlRecord>;
  const root = parsed["talendfile:ContextType"] ?? parsed.ContextType;
  if (!root) return [];

  const contexts: RepositoryContextContext[] = [];

  if (root.context !== undefined) {
    asArray(root.context as XmlRecord | XmlRecord[] | undefined).forEach((context) => {
      contexts.push({
        contextName: attr(context, "name") ?? "",
        parameters: parseItemParameters(context),
      });
    });
  } else {
    contexts.push({
      contextName: attr(root, "name") ?? "",
      parameters: parseItemParameters(root),
    });
  }

  return contexts;
}

function parseProperties(parsed: XmlRecord): { label: string; version: string; purpose?: string; description?: string } {
  const xmi = (parsed["xmi:XMI"] ?? parsed["xmi_XMI"] ?? parsed) as XmlRecord;
  const propRaw = xmi["TalendProperties:Property"] ?? xmi["TalendProperties_Property"];
  const property = (typeof propRaw === "object" ? propRaw : {}) as XmlRecord;

  let purpose = attr(property, "purpose");
  let description = attr(property, "description");

  const additionalProps = asArray(property.additionalProperties as XmlRecord | XmlRecord[] | undefined);
  for (const ap of additionalProps) {
    const key = attr(ap, "key");
    const value = attr(ap, "value");
    if (key === "purpose" && !purpose) purpose = value;
    if (key === "description" && !description) description = value;
  }

  return {
    label: attr(property, "label") ?? "",
    version: attr(property, "version") ?? "0.1",
    purpose,
    description,
  };
}

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

// generateTalendId moved to utils.ts

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

function updateItemXmlParameter(
  xml: string,
  options: { contextName: string; parameterName: string; value: string; type?: string; prompt?: string },
  mode: "update" | "upsert",
): string {
  const document = parseXml(xml) as Record<string, XmlRecord>;
  const root = document["talendfile:ContextType"] ?? document.ContextType;
  if (!root) throw new Error("XML de contexto Talend inválido");

  let targetParams: XmlRecord[];

  if (root.context !== undefined) {
    const contexts = asArray(root.context as XmlRecord | XmlRecord[] | undefined);
    const context = contexts.find((item) => attr(item, "name") === options.contextName);
    if (!context) throw new Error(`Contexto no encontrado: ${options.contextName}`);
    targetParams = asArray(context.contextParameter as XmlRecord | XmlRecord[] | undefined);
  } else {
    const rootContextName = attr(root, "name");
    if (rootContextName !== options.contextName) {
      throw new Error(`Contexto no encontrado: ${options.contextName}`);
    }
    targetParams = asArray(root.contextParameter as XmlRecord | XmlRecord[] | undefined);
  }

  const target = targetParams.find((p) => attr(p, "name") === options.parameterName);

  if (target) {
    target["@_value"] = options.value;
    if (options.type !== undefined) target["@_type"] = options.type;
    if (options.prompt !== undefined) target["@_prompt"] = options.prompt;
  } else if (mode === "upsert") {
    const newParam: XmlRecord = {
      "@_xmi:id": generateTalendId(),
      "@_name": options.parameterName,
      "@_value": options.value,
    };
    if (options.type !== undefined) newParam["@_type"] = options.type;
    if (options.prompt !== undefined) newParam["@_prompt"] = options.prompt;
    targetParams.push(newParam);
  } else {
    throw new Error(`Parámetro no encontrado: ${options.parameterName}`);
  }

  if (root.context !== undefined) {
    root.contextParameter = targetParams.length === 1 ? targetParams[0] : targetParams;
  } else {
    root.contextParameter = targetParams.length === 1 ? targetParams[0] : targetParams;
  }

  return buildXml(document);
}

function deleteItemXmlParameter(xml: string, options: { contextName: string; parameterName: string }): string {
  const document = parseXml(xml) as Record<string, XmlRecord>;
  const root = document["talendfile:ContextType"] ?? document.ContextType;
  if (!root) throw new Error("XML de contexto Talend inválido");

  let targetParams: XmlRecord[];

  if (root.context !== undefined) {
    const contexts = asArray(root.context as XmlRecord | XmlRecord[] | undefined);
    const context = contexts.find((item) => attr(item, "name") === options.contextName);
    if (!context) throw new Error(`Contexto no encontrado: ${options.contextName}`);
    targetParams = asArray(context.contextParameter as XmlRecord | XmlRecord[] | undefined);
  } else {
    const rootContextName = attr(root, "name");
    if (rootContextName !== options.contextName) {
      throw new Error(`Contexto no encontrado: ${options.contextName}`);
    }
    targetParams = asArray(root.contextParameter as XmlRecord | XmlRecord[] | undefined);
  }

  const filtered = targetParams.filter((p) => attr(p, "name") !== options.parameterName);
  if (filtered.length === targetParams.length) throw new Error(`Parámetro no encontrado: ${options.parameterName}`);

  root.contextParameter = filtered.length === 1 ? filtered[0] : filtered;
  return buildXml(document);
}

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

export async function deleteRepositoryContext(
  projectPath: string,
  contextName: string,
): Promise<{ itemPath: string; propertiesPath: string }> {
  const { itemPath, propertiesPath } = resolveContextFiles(projectPath, contextName);
  if (existsSync(itemPath)) rmSync(itemPath, { force: true });
  if (existsSync(propertiesPath)) rmSync(propertiesPath, { force: true });
  return { itemPath, propertiesPath };
}

export function formatRepositoryContext(context: RepositoryContext): string {
  const lines: string[] = [];
  lines.push(`${context.name} (v${context.version})${context.purpose ? ` — ${context.purpose}` : ""}`);
  if (context.description) lines.push(`  ${context.description}`);
  for (const ctx of context.contexts) {
    lines.push(`  Contexto: ${ctx.contextName} (${ctx.parameters.length} variables)`);
    for (const param of ctx.parameters) {
      lines.push(`    - ${param.name} = ${param.value ?? ""}${param.type ? ` (${param.type})` : ""}`);
    }
  }
  return lines.join("\n");
}

export function formatRepositoryContextList(contexts: RepositoryContext[]): string {
  if (contexts.length === 0) return "No se encontraron contextos de repositorio.";
  return contexts
    .map((ctx) => {
      const totalParams = ctx.contexts.reduce((acc, c) => acc + c.parameters.length, 0);
      return `${ctx.name} (v${ctx.version}) — ${ctx.contexts.length} contexto(s), ${totalParams} variable(s)${ctx.purpose ? ` | ${ctx.purpose}` : ""}`;
    })
    .join("\n");
}