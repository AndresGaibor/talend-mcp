import { rmSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { asArray, buildXml, parseXml } from "../xml/xml-utils";
import { readTextFile, writeTextFile, listFilesRecursive } from "../filesystem/file-reader";
import { splitPortable } from "../../platform/path-bridge";
import type { IJobRepository, ParsedJob, JobSpec } from "../../domain/job/job.repository";
import type { TalendComponent, TalendConnection, TalendContextParameter, MapperEntry, TalendJobResource } from "../../domain/job/job.entity";

type XmlRecord = Record<string, unknown>;

function attr(nodo: XmlRecord | undefined, nombre: string): string | undefined {
  const valor = nodo?.[`@_${nombre}`];
  return typeof valor === "string" ? valor : undefined;
}

function nodeAttributes(node: XmlRecord): Record<string, string> {
  const atributos: Record<string, string> = {};
  for (const [clave, valor] of Object.entries(node)) {
    if (clave.startsWith("@_") && typeof valor === "string") {
      atributos[clave.slice(2)] = valor;
    }
  }
  return atributos;
}

function boolAttr(nodo: XmlRecord, nombre: string): boolean | undefined {
  const valor = attr(nodo, nombre);
  if (valor === undefined) return undefined;
  return valor === "true";
}

function numberAttr(nodo: XmlRecord, nombre: string): number | undefined {
  const valor = attr(nodo, nombre);
  if (valor === undefined || valor === "") return undefined;
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : undefined;
}

function cleanQuoted(valor: string | undefined): string | undefined {
  if (!valor) return valor;
  return valor.replace(/^&quot;/, "").replace(/&quot;$/, "").replace(/^"/, "").replace(/"$/, "");
}

function parseParameters(node: XmlRecord): Record<string, string> {
  const parametros: Record<string, string> = {};
  for (const parametro of asArray(node.elementParameter as XmlRecord | XmlRecord[] | undefined)) {
    const name = attr(parametro, "name");
    const value = attr(parametro, "value");
    if (name && value !== undefined) parametros[name] = cleanQuoted(value) ?? value;
  }
  return parametros;
}

function parseColumn(column: XmlRecord) {
  return {
    name: attr(column, "name") ?? "",
    type: attr(column, "type"),
    length: numberAttr(column, "length"),
    precision: numberAttr(column, "precision"),
    nullable: boolAttr(column, "nullable"),
    key: boolAttr(column, "key"),
    sourceType: attr(column, "sourceType"),
    pattern: cleanQuoted(attr(column, "pattern")),
  };
}

function parseSchemas(node: XmlRecord) {
  return asArray(node.metadata as XmlRecord | XmlRecord[] | undefined).map((metadata) => ({
    connector: attr(metadata, "connector"),
    name: attr(metadata, "name"),
    label: attr(metadata, "label"),
    columns: asArray(metadata.column as XmlRecord | XmlRecord[] | undefined).map(parseColumn),
  }));
}

function parseMapperEntries(node: XmlRecord): MapperEntry[] {
  const nodeData = node.nodeData as XmlRecord | undefined;
  const entries: MapperEntry[] = [];

  for (const tableKey of ["outputTables", "inputTables", "varTables"] as const) {
    for (const table of asArray(nodeData?.[tableKey] as XmlRecord | XmlRecord[] | undefined)) {
      const tableName = attr(table, "name") ?? tableKey;
      for (const entry of asArray(table.mapperTableEntries as XmlRecord | XmlRecord[] | undefined)) {
        entries.push({
          table: tableName,
          name: attr(entry, "name") ?? "",
          expression: attr(entry, "expression"),
          type: attr(entry, "type"),
          nullable: boolAttr(entry, "nullable"),
        });
      }
    }
  }

  return entries;
}

function parseXmlToJob(xml: string, itemPath: string): ParsedJob {
  const parsed = parseXml(xml) as Record<string, XmlRecord>;
  const root = parsed["talendfile:ProcessType"] ?? parsed.ProcessType;
  if (!root) throw new Error("XML de job Talend inválido: falta talendfile:ProcessType");

  const contexts = asArray(root.context as XmlRecord | XmlRecord[] | undefined).flatMap((contexto) =>
    asArray(contexto.contextParameter as XmlRecord | XmlRecord[] | undefined).map<TalendContextParameter>(
      (parametro) => ({
        name: attr(parametro, "name") ?? "",
        type: attr(parametro, "type"),
        value: attr(parametro, "value"),
        prompt: attr(parametro, "prompt"),
      }),
    ),
  );

  const components = asArray(root.node as XmlRecord | XmlRecord[] | undefined).map<TalendComponent>((node) => {
    const parameters = parseParameters(node);
    return {
      uniqueName: parameters.UNIQUE_NAME ?? "",
      componentName: attr(node, "componentName") ?? "",
      label: parameters.LABEL,
      nodeAttributes: nodeAttributes(node),
      parameters,
      schemas: parseSchemas(node),
      rawNodeData: node.nodeData,
    };
  });

  const mapperEntries = asArray(root.node as XmlRecord | XmlRecord[] | undefined).flatMap(parseMapperEntries);

  const connections = asArray(root.connection as XmlRecord | XmlRecord[] | undefined).map<TalendConnection>(
    (connection) => {
      const parameters = parseParameters(connection);
      return {
        connectorName: attr(connection, "connectorName"),
        label: attr(connection, "label"),
        metaname: attr(connection, "metaname"),
        source: attr(connection, "source") ?? "",
        target: attr(connection, "target") ?? "",
        uniqueName: parameters.UNIQUE_NAME,
      };
    },
  );

  return { itemPath, components, connections, contexts, mapperEntries };
}

function generateTalendId(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  let result = "_";
  for (let i = 0; i < 22; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function buildElementParameter(name: string, value: string, field = "TEXT"): Record<string, unknown> {
  return { "@_field": field, "@_name": name, "@_value": value };
}

function buildColumn(col: { name: string; type?: string; length?: number; precision?: number; nullable?: boolean; key?: boolean; sourceType?: string; pattern?: string }): Record<string, unknown> {
  const node: Record<string, unknown> = { "@_name": col.name, "@_type": col.type ?? "id_String" };
  if (col.length !== undefined) node["@_length"] = String(col.length);
  if (col.precision !== undefined) node["@_precision"] = String(col.precision);
  if (col.nullable !== undefined) node["@_nullable"] = col.nullable ? "true" : "false";
  if (col.key !== undefined) node["@_key"] = col.key ? "true" : "false";
  if (col.sourceType !== undefined) node["@_sourceType"] = col.sourceType;
  if (col.pattern !== undefined) node["@_pattern"] = col.pattern;
  return node;
}

function buildComponentNode(comp: TalendComponent): Record<string, unknown> {
  const parameters: Record<string, unknown>[] = [buildElementParameter("UNIQUE_NAME", comp.uniqueName)];
  if (comp.label) parameters.push(buildElementParameter("LABEL", comp.label));

  if (comp.parameters) {
    for (const [key, value] of Object.entries(comp.parameters)) {
      parameters.push(buildElementParameter(key, value));
    }
  }

  const node: Record<string, unknown> = {
    "@_xmi:id": generateTalendId(),
    "@_componentName": comp.componentName,
    elementParameter: parameters.length === 1 ? parameters[0] : parameters,
  };

  const posX = comp.nodeAttributes?.posX;
  const posY = comp.nodeAttributes?.posY;
  if (posX !== undefined) node["@_posX"] = posX;
  if (posY !== undefined) node["@_posY"] = posY;

  if (comp.schemas && comp.schemas.length > 0 && comp.schemas[0]) {
    const schema = comp.schemas[0]!;
    const metadata: Record<string, unknown> = {
      "@_connector": schema.connector ?? "FLOW",
      "@_label": schema.label ?? schema.name ?? comp.uniqueName,
      "@_name": schema.name ?? comp.uniqueName,
      "@_xmi:id": generateTalendId(),
      column: schema.columns.map(c => buildColumn(c)),
    };
    node.metadata = metadata;
  }

  if (comp.rawNodeData) {
    node.nodeData = comp.rawNodeData;
  }

  return node;
}

function buildConnectionNode(conn: TalendConnection): Record<string, unknown> {
  const node: Record<string, unknown> = {
    "@_xmi:id": generateTalendId(),
    "@_source": conn.source,
    "@_target": conn.target,
    "@_label": conn.label ?? "",
    elementParameter: buildElementParameter("UNIQUE_NAME", conn.uniqueName ?? conn.label ?? ""),
  };
  if (conn.connectorName) node["@_connectorName"] = conn.connectorName;
  if (conn.metaname) node["@_metaname"] = conn.metaname;
  return node;
}

function buildJobXml(job: ParsedJob, defaultContext = "Default"): string {
  const contextSection = {
    context: {
      "@_confirmationNeeded": "false",
      "@_hide": "false",
      "@_name": defaultContext,
      contextParameter: job.contexts.length === 1 ? job.contexts.map(p => ({
        "@_xmi:id": generateTalendId(),
        "@_name": p.name,
        "@_type": p.type ?? "id_String",
        "@_value": p.value ?? "",
      })) : job.contexts.map(p => ({
        "@_xmi:id": generateTalendId(),
        "@_name": p.name,
        "@_type": p.type ?? "id_String",
        "@_value": p.value ?? "",
      })),
    },
  };

  const nodes = job.components.map(c => buildComponentNode(c));
  const nodeSection = nodes.length === 1 ? nodes[0] : nodes;

  let connectionSection: unknown = [];
  if (job.connections.length > 0) {
    const connNodes = job.connections.map(c => buildConnectionNode(c));
    connectionSection = connNodes.length === 1 ? connNodes[0] : connNodes;
  }

  const root: Record<string, unknown> = {
    "@_xmi:version": "2.0",
    "@_xmlns:xmi": "http://www.omg.org/XMI",
    "@_xmlns:talendfile": "platform:/resource/org.talend.model/model/TalendFile.xsd",
    "@_xmi:id": generateTalendId(),
    "@_defaultContext": defaultContext,
    "@_jobType": "Standard",
  };

  Object.assign(root, contextSection);
  root.node = nodeSection;
  if (Array.isArray(connectionSection) ? connectionSection.length > 0 : connectionSection) {
    root.connection = connectionSection;
  }

  const doc = {
    "talendfile:ProcessType": root,
  };

  return buildXml(doc);
}

function parseJobProperties(xml: string, propertiesPath: string): TalendJobResource {
  const parsed = parseXml(xml) as Record<string, unknown>;
  const root = parsed["xmi:XMI"] as Record<string, unknown> | undefined;
  const property = root?.["TalendProperties:Property"] as Record<string, string> | undefined;
  const processItem = root?.["TalendProperties:ProcessItem"] as Record<string, unknown> | undefined;
  const itemState = root?.["TalendProperties:ItemState"] as Record<string, string> | undefined;
  const process = processItem?.process as Record<string, string> | undefined;
  const href = process?.["@_href"] ?? "";
  const itemFile = href.split("#")[0] ?? "";
  const folderPath = itemState?.["@_path"] ?? "";

  return {
    label: property?.["@_label"] ?? "",
    version: property?.["@_version"] ?? "",
    folderPath: folderPath || undefined,
    purpose: property?.["@_purpose"],
    description: property?.["@_description"],
    itemPath: join(dirname(propertiesPath), itemFile),
    propertiesPath,
  };
}

async function listTalendJobs(projectPath: string): Promise<TalendJobResource[]> {
  const processPath = join(projectPath, "process");
  const propertiesFiles = await listFilesRecursive(processPath, (ruta) => ruta.endsWith(".properties"));
  const jobs: TalendJobResource[] = [];

  for (const propertiesPath of propertiesFiles) {
    const xml = await readTextFile(propertiesPath, projectPath);
    const job = parseJobProperties(xml, propertiesPath);
    if (job.label && job.itemPath.endsWith(".item")) jobs.push(job);
  }

  return jobs;
}

  function normalizeFolderPath(folderPath?: string): string | undefined {
  const normalized = folderPath?.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "").trim();
  if (!normalized) return undefined;

  const parts = splitPortable(normalized);
  if (parts.some((part) => part === ".." || part === "." || part === "")) {
    throw new Error(`Ruta de carpeta inválida: ${folderPath}`);
  }

  return normalized;
}

function resolveFolderDir(projectPath: string, folderPath?: string): string {
  const normalized = normalizeFolderPath(folderPath);
  return normalized ? join(projectPath, "process", ...splitPortable(normalized)) : join(projectPath, "process");
}

async function findTalendJob(projectPath: string, jobName: string, folderPath?: string): Promise<TalendJobResource> {
  const normalizedFolder = normalizeFolderPath(folderPath);
  const jobs = await listTalendJobs(projectPath);
  const matches = jobs.filter((job) => job.label === jobName && (normalizedFolder === undefined || normalizeFolderPath(job.folderPath) === normalizedFolder));

  if (matches.length === 0) {
    throw new Error(`Job no encontrado: ${jobName}`);
  }

  if (matches.length > 1) {
    throw new Error(`Job ambiguo: ${jobName}`);
  }

  return matches[0]!;
}

function createEmptyJobItemXml(jobName: string, version: string, defaultContext = "Default"): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<talendfile:ProcessType defaultContext="${defaultContext}" jobType="Standard">
  <context name="${defaultContext}"/>
</talendfile:ProcessType>`;
}

function createEmptyJobPropertiesXml(options: { label: string; version: string; itemFileName: string; folderPath?: string }): string {
  const folderPath = normalizeFolderPath(options.folderPath) ?? "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<xmi:XMI>
  <TalendProperties:Property label="${options.label}" version="${options.version}" displayName="${options.label}"/>
  <TalendProperties:ItemState path="${folderPath}"/>
  <TalendProperties:ProcessItem>
    <process href="${options.itemFileName}#/"/>
  </TalendProperties:ProcessItem>
</xmi:XMI>`;
}

function getJobVersion(itemPath: string): string {
  const match = itemPath.match(/_(\d+\.\d+)\.item$/);
  return match?.[1] ?? "0.1";
}

export class JobXmlRepository implements IJobRepository {
  async listJobs(projectPath: string): Promise<string[]> {
    const jobs = await listTalendJobs(projectPath);
    return jobs.map(job => job.itemPath);
  }

  async findJob(itemPath: string): Promise<string> {
    return await readTextFile(itemPath);
  }

  async createJob(projectPath: string, name: string, spec?: JobSpec): Promise<string> {
    const version = spec?.version ?? "0.1";
    const itemFileName = `${name}_${version}.item`;
    const propertiesFileName = `${name}_${version}.properties`;
    const jobDir = resolveFolderDir(projectPath, undefined);

    let itemXml: string;
    if (spec && spec.components && spec.components.length > 0) {
      const parsedJob = this.buildParsedJobFromSpec(spec, itemFileName, jobDir);
      itemXml = buildJobXml(parsedJob);
    } else {
      itemXml = createEmptyJobItemXml(name, version);
    }

    const propertiesXml = createEmptyJobPropertiesXml({
      label: name,
      version,
      itemFileName,
      folderPath: undefined,
    });

    const itemPath = join(jobDir, itemFileName);
    const propertiesPath = join(jobDir, propertiesFileName);

    await writeTextFile(itemPath, itemXml, projectPath);
    await writeTextFile(propertiesPath, propertiesXml, projectPath);

    return itemPath;
  }

  private buildParsedJobFromSpec(spec: JobSpec, itemFileName: string, jobDir: string): ParsedJob {
    const components = spec.components!.map((c) => {
      const schemas = c.schemas?.map((s) => ({
        name: s.name ?? "",
        connector: s.connector,
        label: s.name,
        columns: s.columns.map((col) => ({
          name: col.name,
          type: col.type,
          length: col.length,
          nullable: col.nullable,
        })),
      })) ?? [];
      return {
        uniqueName: c.uniqueName,
        componentName: c.componentName,
        label: c.label,
        nodeAttributes: {} as Record<string, string>,
        parameters: c.parameters ?? {},
        schemas,
        rawNodeData: undefined,
      };
    });

    const connections = (spec.connections ?? []).map((c) => ({
      source: c.source,
      target: c.target,
      label: c.label ?? "",
      metaname: c.metaname,
      uniqueName: undefined,
    }));

    const contexts = (spec.contextParameters ?? []).map((p) => ({
      name: p.name,
      type: p.type,
      value: p.value,
      prompt: p.prompt,
    }));

    return {
      itemPath: join(jobDir, itemFileName),
      components,
      connections,
      contexts,
      mapperEntries: [],
    };
  }

  async deleteJob(itemPath: string): Promise<void> {
    const propertiesPath = itemPath.replace(/\.item$/, ".properties");
    rmSync(itemPath, { force: true });
    rmSync(propertiesPath, { force: true });
  }

  async renameJob(itemPath: string, newName: string): Promise<string> {
    const projectPath = dirname(dirname(dirname(itemPath)));
    const jobName = basename(itemPath).replace(/_\d+\.\d+\.item$/, "");
    const itemNormalized = itemPath.replace(/\\/g, "/");
    const folderPath = itemNormalized.includes("/process/") ? itemNormalized.split("/process/")[1]?.replace(/\/[^/]+$/, "") : undefined;

    const source = await findTalendJob(projectPath, jobName, folderPath);
    const oldItemXml = await readTextFile(source.itemPath, projectPath);
    const oldPropertiesXml = await readTextFile(source.propertiesPath, projectPath);
    const version = getJobVersion(source.itemPath);
    const newItemFileName = `${newName}_${version}.item`;
    const newPropertiesFileName = `${newName}_${version}.properties`;
    const jobDir = resolveFolderDir(projectPath, source.folderPath);
    const newItemPath = join(jobDir, newItemFileName);
    const newPropertiesPath = join(jobDir, newPropertiesFileName);
    const newPropertiesXml = oldPropertiesXml
      .replace(/label="[^"]*"/g, `label="${newName}"`)
      .replace(/displayName="[^"]*"/g, `displayName="${newName}"`)
      .replace(/href="[^"]*\.item"/g, `href="${newItemFileName}"`);

    await writeTextFile(newItemPath, oldItemXml, projectPath);
    await writeTextFile(newPropertiesPath, newPropertiesXml, projectPath);

    if (newItemPath !== source.itemPath) rmSync(source.itemPath, { force: true });
    if (newPropertiesPath !== source.propertiesPath) rmSync(source.propertiesPath, { force: true });

    return newItemPath;
  }

  async duplicateJob(itemPath: string, newName: string): Promise<string> {
    const projectPath = dirname(dirname(dirname(itemPath)));
    const jobName = basename(itemPath).replace(/_\d+\.\d+\.item$/, "");
    const itemNormalized = itemPath.replace(/\\/g, "/");
    const folderPath = itemNormalized.includes("/process/") ? itemNormalized.split("/process/")[1]?.replace(/\/[^/]+$/, "") : undefined;

    const source = await findTalendJob(projectPath, jobName, folderPath);
    const version = getJobVersion(source.itemPath);
    const targetFolderPath = normalizeFolderPath(folderPath) ?? normalizeFolderPath(source.folderPath);
    const newItemFileName = `${newName}_${version}.item`;
    const newPropertiesFileName = `${newName}_${version}.properties`;
    const jobDir = resolveFolderDir(projectPath, targetFolderPath);

    const oldItemXml = await readTextFile(source.itemPath, projectPath);
    const oldPropertiesXml = await readTextFile(source.propertiesPath, projectPath);
    const newItemPath = join(jobDir, newItemFileName);
    const newPropertiesPath = join(jobDir, newPropertiesFileName);
    const newPropertiesXml = oldPropertiesXml
      .replace(/label="[^"]*"/g, `label="${newName}"`)
      .replace(/displayName="[^"]*"/g, `displayName="${newName}"`)
      .replace(/href="[^"]*\.item"/g, `href="${newItemFileName}"`)
      .replace(/(<TalendProperties:ItemState[^>]*\spath=")[^"]*(")/, `$1${targetFolderPath ?? ""}$2`);

    await writeTextFile(newItemPath, oldItemXml, projectPath);
    await writeTextFile(newPropertiesPath, newPropertiesXml, projectPath);

    return newItemPath;
  }

  async moveJob(itemPath: string, newFolderPath: string): Promise<string> {
    const projectPath = dirname(dirname(dirname(itemPath)));
    const jobName = basename(itemPath).replace(/_\d+\.\d+\.item$/, "");

    const source = await findTalendJob(projectPath, jobName);
    const targetFolderPath = normalizeFolderPath(newFolderPath);
    const jobDir = resolveFolderDir(projectPath, targetFolderPath);
    const itemFileName = basename(itemPath);
    const propertiesFileName = basename(source.propertiesPath);
    const newItemPath = join(jobDir, itemFileName);
    const newPropertiesPath = join(jobDir, propertiesFileName);

    if (newItemPath === source.itemPath && newPropertiesPath === source.propertiesPath) {
      return newItemPath;
    }

    const oldItemXml = await readTextFile(source.itemPath, projectPath);
    const oldPropertiesXml = await readTextFile(source.propertiesPath, projectPath);
    const newPropertiesXml = oldPropertiesXml.replace(/(<TalendProperties:ItemState[^>]*\spath=")[^"]*(")/, `$1${targetFolderPath ?? ""}$2`);

    await writeTextFile(newItemPath, oldItemXml, projectPath);
    await writeTextFile(newPropertiesPath, newPropertiesXml, projectPath);

    rmSync(source.itemPath, { force: true });
    rmSync(source.propertiesPath, { force: true });

    return newItemPath;
  }

  async parseJob(itemPath: string): Promise<ParsedJob> {
    const xml = await readTextFile(itemPath);
    return parseXmlToJob(xml, itemPath);
  }

  async writeJob(itemPath: string, job: ParsedJob): Promise<void> {
    const xml = buildJobXml(job);
    await writeTextFile(itemPath, xml);
  }

  async writeJobProperties(itemPath: string, properties: Record<string, string>): Promise<void> {
    const xml = await readTextFile(itemPath);
    let updatedXml = xml;
    for (const [key, value] of Object.entries(properties)) {
      const regex = new RegExp(`(@_${key}="[^"]*"|${key}="[^"]*")`, "g");
      if (updatedXml.includes(key)) {
        updatedXml = updatedXml.replace(regex, `${key}="${value}"`);
      }
    }
    await writeTextFile(itemPath, updatedXml);
  }
}