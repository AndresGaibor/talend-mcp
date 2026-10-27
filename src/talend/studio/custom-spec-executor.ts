import { isAbsolute, relative } from "node:path";
import type { TalendStudioBridgeClient } from "../../modules/studio-bridge/adapters/http-studio-bridge.client";
import type { TalendJobResource } from "../types";
import { resolveNewJobTarget } from "./apply-safety";

export type CustomSpecBridge = Pick<TalendStudioBridgeClient,
  | "listComponents"
  | "componentParameters"
  | "createJob"
  | "openJob"
  | "listNodes"
  | "addContextParameters"
  | "jobContexts"
  | "setJobContextParameter"
  | "addNode"
  | "configureNode"
  | "updateNode"
  | "connectNodes"
  | "disconnectNodes"
  | "deleteNodes"
  | "activeJobModel"
  | "deleteJob"
>;

export type CustomSpecContext = {
  name: string;
  type: string;
  value: string;
  comment?: string;
};

export type CustomSpecSchemaTable = {
  name: string;
  connector?: string;
  columns: Array<Record<string, unknown>>;
};

export type CustomSpecComponent = {
  uniqueName: string;
  componentName: string;
  posX?: number;
  posY?: number;
  label?: string;
  parameters?: Record<string, string>;
  tables?: Record<string, { columns?: string[]; rows?: Array<string[] | Record<string, string>> }>;
  schema?: CustomSpecSchemaTable | CustomSpecSchemaTable[];
  mapper?: Record<string, unknown>;
  draftOnly?: boolean;
  draftReason?: string;
};

export type CustomSpecConnection = {
  source: string;
  target: string;
  label?: string;
  connectorName?: string;
  uniqueName?: string;
};

export type CustomSpecInput = {
  jobName: string;
  version?: string;
  defaultContext?: string;
  folderPath?: string;
  description?: string;
  purpose?: string;
  components: CustomSpecComponent[];
  connections?: CustomSpecConnection[];
  contexts?: CustomSpecContext[];
  replaceManagedTodoContexts?: boolean;
  instructions?: Record<string, unknown>;
  childJobs?: CustomSpecInput[];
};

export type CustomSpecResult = {
  jobName: string;
  version: string;
  itemPath: string;
  folderPath: string;
  reusedExisting: boolean;
  generatedComponents: number;
  reusedComponents: number;
  generatedConnections: number;
  reusedConnections: number;
  connections: number;
  generatedContexts: number;
  updatedContexts: number;
  reusedContexts: number;
  removedContexts: number;
  removedConnections: number;
  removedComponents: number;
  totalComponents: number;
  studioApi: true;
  bridgeRefreshed: true;
  bridgeOpened: true;
  warnings: string[];
  childJobs: CustomSpecResult[];
};

type PreparedComponent = {
  spec: CustomSpecComponent;
  parameters?: Record<string, { value: string }>;
  tables?: CustomSpecComponent["tables"];
  schema?: CustomSpecSchemaTable[];
  mapper?: Record<string, unknown>;
};

type ExecutorDependencies = {
  bridge: CustomSpecBridge;
  projectPath: string;
  listJobs: (projectPath: string) => Promise<TalendJobResource[]>;
};

function asObject(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function unwrap<T>(response: { ok: boolean; data?: unknown; error?: { code?: string; message?: string } }, operation: string): T {
  if (!response.ok) {
    throw new Error(`${operation}: ${response.error?.message ?? response.error?.code ?? "Bridge no disponible"}`);
  }
  const data = asObject(response.data);
  if (data?.ok === false) {
    const error = data.error;
    const message = typeof error === "string" ? error : asObject(error)?.message;
    throw new Error(`${operation}: ${String(message ?? "Talend Studio rechazó la operación")}`);
  }
  if (data && Object.hasOwn(data, "result")) return data.result as T;
  return (data ?? response.data) as T;
}

function normalizeFolder(folderPath: string): { normalized: string; childFolders: string[] } {
  const parts = folderPath.replace(/\\/g, "/").split("/").filter(Boolean);
  if (!parts.length || parts[0]!.toLowerCase() !== "process") {
    throw new Error("folderPath debe estar dentro de Process/");
  }
  const childFolders = parts.slice(1);
  if (childFolders.some((part) => part === "." || part === ".." || !/^[\w .-]+$/.test(part))) {
    throw new Error("folderPath contiene segmentos no permitidos");
  }
  return { normalized: ["Process", ...childFolders].join("/"), childFolders };
}

function projectRelativeItemPath(projectPath: string, itemPath: string): string {
  const path = relative(projectPath, itemPath);
  const normalized = path.replace(/\\/g, "/");
  if (!normalized || isAbsolute(path) || normalized === ".." || normalized.startsWith("../")) {
    throw new Error("La ruta del Job existente está fuera del proyecto Talend");
  }
  if (!/^process(?:_mr)?\//i.test(normalized)) {
    throw new Error("La ruta del Job existente debe estar dentro de process/");
  }
  return normalized;
}

function targetSuffixes(jobName: string, version: string, childFolders: string[]): string[] {
  const filename = `${jobName}_${version}.item`.toLowerCase();
  const direct = ["process", ...childFolders, filename].join("/").toLowerCase();
  const studio = ["process", ...childFolders, jobName, filename].join("/").toLowerCase();
  const legacy = childFolders.length
    ? ["process", jobName, ...childFolders, filename].join("/").toLowerCase()
    : ["process", jobName, filename].join("/").toLowerCase();
  return [...new Set([direct, studio, legacy])];
}

async function findTargetJob(
  projectPath: string,
  jobs: TalendJobResource[],
  jobName: string,
  version: string,
  childFolders: string[],
  identity: { description?: string; purpose?: string },
): Promise<{ job: TalendJobResource; relativeItemPath: string } | undefined> {
  const named = jobs.filter((job) => job.label.toLowerCase() === jobName.toLowerCase());
  const suffixes = targetSuffixes(jobName, version, childFolders);
  const target = named.flatMap((job) => {
    if (job.version !== version) return [];
    const itemPath = projectRelativeItemPath(projectPath, job.itemPath);
    return suffixes.some((suffix) => itemPath.toLowerCase().endsWith(suffix))
      ? [{ job, relativeItemPath: itemPath }]
      : [];
  });
  if (target.length > 1) {
    throw new Error(`Hay más de un Job ${jobName} en ${["Process", ...childFolders].join("/")}; no se modificó ninguno.`);
  }
  if (target.length === 1) {
    const match = target[0]!;
    if (identity.description && match.job.description && match.job.description !== identity.description) {
      throw new Error(`El Job ${jobName} en la carpeta configurada pertenece a otro programa; no se modificó.`);
    }
    if (identity.purpose && match.job.purpose && match.job.purpose !== identity.purpose) {
      throw new Error(`El Job ${jobName} en la carpeta configurada tiene otro propósito; no se modificó.`);
    }
    return match;
  }
  const identityMatches = named.flatMap((job) => {
    const descriptionMatches = Boolean(identity.description) && job.description === identity.description;
    const purposeMatches = !job.purpose || !identity.purpose || job.purpose === identity.purpose;
    if (job.version !== version || !descriptionMatches || !purposeMatches) return [];
    return [{ job, relativeItemPath: projectRelativeItemPath(projectPath, job.itemPath) }];
  });
  if (identityMatches.length > 1) {
    throw new Error(`Hay varios Jobs ${jobName} con la misma identidad SAS; no se modificó ninguno.`);
  }
  if (identityMatches.length === 1) return identityMatches[0];
  if (named.length) {
    throw new Error(`Ya existe un Job ${jobName} fuera de la carpeta configurada; no se modificó.`);
  }
  return undefined;
}

function folderPathForItem(projectPath: string, itemPath: string, jobName: string): string {
  const relativePath = projectRelativeItemPath(projectPath, itemPath).replace(/\\/g, "/");
  const parts = relativePath.split("/");
  const folders = parts.slice(0, -1);
  if (folders.at(-1)?.toLowerCase() === jobName.toLowerCase()) folders.pop();
  if (folders.length === 0) return "Process";
  return [folders[0]!.replace(/^process(?:_mr)?$/i, "Process"), ...folders.slice(1)].join("/");
}

function componentCatalogNames(value: unknown): string[] {
  const result = asObject(value);
  const names = result?.components;
  return Array.isArray(names) ? names.filter((name): name is string => typeof name === "string") : [];
}

function parameterDefinitions(value: unknown): Array<Record<string, unknown>> {
  const result = asObject(value);
  return Array.isArray(result?.parameters)
    ? result.parameters.map(asObject).filter((item): item is Record<string, unknown> => Boolean(item))
    : [];
}

function prepareComponent(
  spec: CustomSpecComponent,
  definitions: Array<Record<string, unknown>>,
  warnings: string[],
  outputConnectors: string[] = [],
): PreparedComponent {
  if (spec.draftOnly) {
    warnings.push(`${spec.componentName} (${spec.label ?? spec.uniqueName}) se aplicará como borrador con los valores verificados: ${spec.draftReason ?? "faltan datos técnicos"}`);
  }

  const byName = new Map(
    definitions.flatMap((definition) => typeof definition.name === "string" ? [[definition.name, definition] as const] : []),
  );
  const rawSchema = spec.schema;
  const schema = Array.isArray(rawSchema)
    ? rawSchema
    : rawSchema
      ? [{ connector: rawSchema.connector ?? "FLOW", name: rawSchema.name, columns: rawSchema.columns }]
      : [];
  const schemaConnectors = new Set(schema.map((table) => canonicalConnector(table.connector ?? "FLOW")));
  for (const connector of outputConnectors) {
    const canonical = canonicalConnector(connector);
    if (schemaConnectors.has(canonical)) continue;
    schema.push({
      connector,
      name: `${spec.uniqueName}_${connector.toLowerCase()}_schema`,
      columns: [],
    });
    schemaConnectors.add(canonical);
  }
  const parameters: Record<string, { value: string }> = {};
  for (const [name, value] of Object.entries(spec.parameters ?? {})) {
    const definition = byName.get(name);
    if (!definition) {
      warnings.push(`${spec.componentName}: se omitió la propiedad no encontrada en Studio: ${name}.`);
      continue;
    }
    if (definition.readOnly === true) {
      warnings.push(`${spec.componentName}: se omitió la propiedad de solo lectura ${name}.`);
      continue;
    }
    parameters[name] = { value };
  }
  if (spec.componentName === "tMap" && !("LINK_STYLE" in parameters)) {
    const linkStyle = byName.get("LINK_STYLE");
    const choices = Array.isArray(linkStyle?.columns)
      ? linkStyle.columns.filter((value): value is string => typeof value === "string")
      : [];
    if (choices.includes("AUTO")) parameters.LINK_STYLE = { value: "AUTO" };
  }
  for (const [name, definition] of byName) {
    const hasDefault = typeof definition.default === "string" && definition.default.length > 0;
    const configuredAsSchema = name === "SCHEMA" && Boolean(schema?.length);
    if (definition.required === true && definition.show !== false && !hasDefault && !(name in parameters) && !configuredAsSchema) {
      warnings.push(`${spec.componentName}: falta configurar la propiedad requerida ${name}.`);
    }
  }
  return {
    spec,
    parameters: Object.keys(parameters).length ? parameters : undefined,
    tables: spec.tables,
    schema: schema.length ? schema : undefined,
    mapper: spec.componentName === "tMap" ? spec.mapper : undefined,
  };
}

function activeConnections(value: unknown): Array<Record<string, unknown>> {
  const model = asObject(value);
  return Array.isArray(model?.connections)
    ? model.connections.map(asObject).filter((item): item is Record<string, unknown> => Boolean(item))
    : [];
}

function connectionEndpointKey(source: string, target: string, name: string): string {
  return `${source.toLowerCase()}|${target.toLowerCase()}|${name.toLowerCase()}`;
}

function canonicalConnector(value: unknown): string {
  const connector = String(value ?? "").replace(/[^a-z0-9]/gi, "").toUpperCase();
  const aliases: Record<string, string> = {
    ONSUBJOBOK: "SUBJOBOK",
    ONSUBJOBERROR: "SUBJOBERROR",
    ONCOMPONENTOK: "COMPONENTOK",
    ONCOMPONENTERROR: "COMPONENTERROR",
  };
  return aliases[connector] ?? connector;
}

function connectionKey(source: string, target: string, name: string, connectorName: unknown): string {
  return `${connectionEndpointKey(source, target, name)}|${canonicalConnector(connectorName)}`;
}

function activeConnector(connection: Record<string, unknown>): unknown {
  return connection.connectorName ?? connection.type;
}

function sourceOperationIds(instructions: Record<string, unknown> | undefined): Set<string> {
  const result = new Set<string>();
  if (!instructions) return result;
  const addOperation = (id: string) => result.add(operationReference(id) ?? id);
  const groups = [instructions.steps, instructions.macros];
  for (const group of groups) {
    if (!Array.isArray(group)) continue;
    for (const raw of group) {
      const item = asObject(raw);
      const directId = item?.operationId ?? item?.id;
      if (typeof directId === "string") addOperation(directId);
      const steps = item?.steps;
      if (!Array.isArray(steps)) continue;
      for (const childRaw of steps) {
        const child = asObject(childRaw);
        const childId = child?.operationId ?? child?.id;
        if (typeof childId === "string") addOperation(childId);
      }
    }
  }
  return result;
}

function operationReference(value: string): string | undefined {
  const match = /^op_(\d+)_/i.exec(value);
  return match ? `sas:${match[1]}` : undefined;
}

function operationTag(label: unknown): string | undefined {
  if (typeof label !== "string") return undefined;
  const legacy = /\[([^\]]+)\]\s*$/.exec(label)?.[1];
  if (legacy) return operationReference(legacy) ?? legacy;
  const compact = /·\s*SAS\s+(\d+)\s*$/i.exec(label);
  return compact ? `sas:${compact[1]}` : undefined;
}

function isPreviousPortalOperation(label: unknown): boolean {
  if (typeof label !== "string") return false;
  const legacy = /\[([^\]]+)\]\s*$/.exec(label)?.[1];
  if (legacy) return /^op_\d+_[a-z0-9_]+_\d+$/i.test(legacy);
  return /·\s*SAS\s+\d+\s*$/i.test(label);
}

function assertActiveJob(modelValue: unknown, jobName: string, version: string): void {
  const model = asObject(modelValue);
  const job = asObject(model?.job);
  if (!job) throw new Error(`Studio no devolvió el Job activo esperado (${jobName}).`);
  const label = job?.label ?? job?.name ?? job?.getLabel ?? job?.getName;
  if (typeof label !== "string" || label.toLowerCase() !== jobName.toLowerCase()) {
    throw new Error(`Studio no confirmó que el Job activo sea ${jobName}; se detuvo la aplicación.`);
  }
  const activeVersion = job.version ?? job.getVersion;
  if (typeof activeVersion === "string" && activeVersion !== version) {
    throw new Error(`Studio abrió la versión ${activeVersion} de ${jobName}, se esperaba ${version}.`);
  }
}

async function waitForActiveJob(
  bridge: CustomSpecBridge,
  jobName: string,
  version: string,
): Promise<unknown> {
  const attempts = 10;
  const retryDelayMs = 200;
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt++) {
    const model = unwrap<unknown>(
      await bridge.activeJobModel(),
      "talend_studio_active_job_model",
    );
    try {
      assertActiveJob(model, jobName, version);
      return model;
    } catch (error) {
      lastError = error;
      if (attempt + 1 < attempts) {
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Studio no confirmó el Job activo esperado (${jobName}).`);
}

function listedNodes(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value.map(asObject).filter((item): item is Record<string, unknown> => Boolean(item))
    : [];
}

function listedContexts(value: unknown): Array<Record<string, unknown>> {
  const result = asObject(value);
  return Array.isArray(result?.contexts)
    ? result.contexts.map(asObject).filter((item): item is Record<string, unknown> => Boolean(item))
    : [];
}

async function synchronizeContextParameters(
  bridge: CustomSpecBridge,
  jobName: string,
  defaultContext: string,
  contexts: CustomSpecContext[],
  warnings: string[],
  replaceManagedTodoContexts: boolean,
): Promise<{ generated: number; updated: number; reused: number; removed: number }> {
  const contextCatalog = unwrap<unknown>(
    await bridge.jobContexts({ job: jobName }),
    "talend_job_contexts_list",
  );
  const availableContexts = listedContexts(contextCatalog);
  const targetContext = availableContexts.find((context) => context.name === defaultContext)
    ?? availableContexts.find((context) => context.isDefault === true);
  const contextName = typeof targetContext?.name === "string" ? targetContext.name : defaultContext;
  const parameters = Array.isArray(targetContext?.parameters)
    ? targetContext.parameters.map(asObject).filter((item): item is Record<string, unknown> => Boolean(item))
    : [];
  const missing: CustomSpecContext[] = [];
  let updated = 0;
  let reused = 0;
  const requestedNames = new Set(contexts.map((context) => context.name));
  const removeManagedTodoNames = replaceManagedTodoContexts
    ? parameters.flatMap((parameter) => {
      const name = parameter.name;
      const value = parameter.value;
      const comment = parameter.comment;
      return typeof name === "string"
        && name.startsWith("migration_todo_")
        && !requestedNames.has(name)
        && (typeof value !== "string" || !value.trim())
        && typeof comment === "string"
        && comment.startsWith("Información técnica pendiente del portal")
        ? [name]
        : [];
    })
    : [];

  for (const context of contexts) {
    const existing = parameters.find((parameter) => parameter.name === context.name);
    if (!existing) {
      missing.push(context);
      continue;
    }
    if (context.value === "" && typeof existing.value === "string" && existing.value.trim()) {
      warnings.push(`Se conservó el valor existente de context.${context.name}; el portal dejó este dato pendiente.`);
      reused++;
      continue;
    }
    if (existing.type === context.type && existing.value === context.value) {
      reused++;
      continue;
    }

    unwrap<unknown>(await bridge.setJobContextParameter({
      job: jobName,
      context: contextName,
      name: context.name,
      value: context.value,
      type: context.type,
    }), "talend_job_context_set");
    updated++;
  }

  if (missing.length || removeManagedTodoNames.length) {
    const result = asObject(unwrap<unknown>(await bridge.addContextParameters({
      contexts: missing,
      removeManagedTodoNames,
    }), "talend_job_add_context_parameters"));
    if (result?.saved === false) throw new Error("Talend Studio no guardó las variables de contexto.");
  }
  return { generated: missing.length, updated, reused, removed: removeManagedTodoNames.length };
}

function matchesNode(node: Record<string, unknown>, component: CustomSpecComponent): boolean {
  return String(node.componentName ?? "") === component.componentName
    && String(node.label ?? "") === (component.label ?? "");
}

function runtimeSchema(component: PreparedComponent, uniqueName: string): CustomSpecSchemaTable[] | undefined {
  const prefix = `${component.spec.uniqueName}_`;
  return component.schema?.map((table) => ({
    ...table,
    name: table.name === `${component.spec.uniqueName}_schema`
      ? uniqueName
      : table.name.startsWith(prefix)
        ? `${uniqueName}${table.name.slice(component.spec.uniqueName.length)}`
        : table.name,
  }));
}

function outputConnectorsByComponent(connections: CustomSpecConnection[]): Map<string, string[]> {
  const triggers = new Set([
    "SUBJOBOK",
    "SUBJOBERROR",
    "COMPONENTOK",
    "COMPONENTERROR",
    "RUNIF",
    "ITERATE",
  ]);
  const result = new Map<string, Set<string>>();
  for (const connection of connections) {
    const connector = connection.connectorName ?? "FLOW";
    if (triggers.has(canonicalConnector(connector))) continue;
    const connectors = result.get(connection.source) ?? new Set<string>();
    connectors.add(connector);
    result.set(connection.source, connectors);
  }
  return new Map([...result.entries()].map(([uniqueName, connectors]) => [uniqueName, [...connectors]]));
}

export async function executeCustomSpec(
  input: CustomSpecInput,
  dependencies: ExecutorDependencies,
): Promise<CustomSpecResult> {
  const childResults: CustomSpecResult[] = [];
  for (const child of input.childJobs ?? []) {
    childResults.push(await executeCustomSpec(child, dependencies));
  }
  const result = await executeOwnCustomSpec(input, dependencies);
  const childWarnings = childResults.flatMap((child) =>
    child.warnings.map((warning) => `${child.jobName}: ${warning}`),
  );
  return {
    ...result,
    warnings: [...childWarnings, ...result.warnings],
    childJobs: childResults,
  };
}

async function executeOwnCustomSpec(
  input: CustomSpecInput,
  dependencies: ExecutorDependencies,
): Promise<CustomSpecResult> {
  const version = input.version ?? "0.1";
  const { normalized: folderPath, childFolders } = normalizeFolder(input.folderPath ?? "Process");
  const jobs = await dependencies.listJobs(dependencies.projectPath);
  const existing = await findTargetJob(dependencies.projectPath, jobs, input.jobName, version, childFolders, {
    description: input.description,
    purpose: input.purpose,
  });
  const warnings: string[] = [];
  const instructions = input.instructions;
  for (const field of ["unresolved", "pending", "assumptions"] as const) {
    const items = instructions?.[field];
    if (Array.isArray(items)) {
      for (const item of items) {
        if (typeof item === "string" && item.trim()) warnings.push(`${field}: ${item}`);
      }
    }
  }

  const prepared: PreparedComponent[] = [];
  const outputConnectors = outputConnectorsByComponent(input.connections ?? []);
  for (const component of input.components) {
    const catalog = unwrap<unknown>(
      await dependencies.bridge.listComponents({ filter: component.componentName, limit: 100_000 }),
      "talend_studio_list_components",
    );
    if (!componentCatalogNames(catalog).includes(component.componentName)) {
      warnings.push(`${component.componentName} (${component.label ?? component.uniqueName}) no existe en la paleta Standard de Studio; se omitió.`);
      continue;
    }
    let definitions: Array<Record<string, unknown>>;
    try {
      definitions = parameterDefinitions(unwrap<unknown>(
        await dependencies.bridge.componentParameters({ name: component.componentName }),
        "talend_studio_component_parameters",
      ));
    } catch (error) {
      warnings.push(`${component.componentName} (${component.label ?? component.uniqueName}) no se pudieron validar sus propiedades en Studio; se usará la configuración predeterminada: ${String(error)}`);
      const declaredParameters = Object.keys(component.parameters ?? {}).map((name) => ({ name, readOnly: false }));
      prepared.push(prepareComponent(component, declaredParameters, warnings, outputConnectors.get(component.uniqueName)));
      continue;
    }
    prepared.push(prepareComponent(component, definitions, warnings, outputConnectors.get(component.uniqueName)));
  }

  const contexts = input.contexts ?? [];
  if (!prepared.length && !contexts.length) {
    throw new Error([
      "No hay componentes verificados ni variables de contexto para crear en Talend Studio.",
      ...warnings,
    ].join(" "));
  }

  let itemPath: string;
  const actualFolderPath = existing
    ? folderPathForItem(dependencies.projectPath, existing.job.itemPath, input.jobName)
    : folderPath;
  let reusedExisting = Boolean(existing);
  if (existing) {
    itemPath = existing.job.itemPath;
  } else {
    const target = resolveNewJobTarget(
      dependencies.projectPath,
      input.jobName,
      version,
      folderPath,
      jobs.map((job) => job.label),
    );
    itemPath = target.itemPath;
  }

  let createdByCall = false;
  const existingNames = new Map<string, string>();
  const existingEdges = new Set<string>();
  let generatedComponents = 0;
  let reusedComponents = 0;
  let generatedConnections = 0;
  let reusedConnections = 0;
  let removedConnections = 0;
  let removedComponents = 0;
  let contextStats = { generated: 0, updated: 0, reused: 0, removed: 0 };

  try {
    if (existing) {
      unwrap(await dependencies.bridge.openJob({
        name: input.jobName,
        version,
        itemPath: existing.relativeItemPath,
      }), "talend_job_open_in_studio");
    } else {
      unwrap(await dependencies.bridge.createJob({
        name: input.jobName,
        version,
        folder: childFolders.join("/"),
        description: input.description,
        replace: false,
      }), "talend_job_create_in_studio");
      createdByCall = true;
    }

    let model = await waitForActiveJob(dependencies.bridge, input.jobName, version);
    let beforeNodes = listedNodes(unwrap<unknown>(await dependencies.bridge.listNodes(), "talend_job_list_nodes"));
    if (!existing && beforeNodes.length) {
      throw new Error("El Job nuevo no está vacío después de crearlo; se detuvo para proteger sus componentes.");
    }

    const expectedByKey = new Map<string, PreparedComponent[]>();
    for (const component of prepared) {
      const key = `${component.spec.componentName}\u0000${component.spec.label ?? ""}`;
      expectedByKey.set(key, [...(expectedByKey.get(key) ?? []), component]);
    }
    const managedIds = sourceOperationIds(instructions);
    const hasSourceIdentity = typeof asObject(instructions?.source)?.program === "string";
    const expectedCounts = new Map(
      [...expectedByKey.entries()].map(([key, components]) => [key, components.length]),
    );
    const expectedIdentityCounts = new Map<string, number>();
    for (const component of prepared) {
      const tag = operationTag(component.spec.label);
      if (!tag) continue;
      const key = `${component.spec.componentName}\u0000${tag}`;
      expectedIdentityCounts.set(key, (expectedIdentityCounts.get(key) ?? 0) + 1);
    }
    const staleManagedNodes: string[] = [];
    for (const node of beforeNodes) {
      const key = `${String(node.componentName ?? "")}\u0000${String(node.label ?? "")}`;
      const exactMatches = expectedByKey.get(key);
      if (exactMatches?.some((component) => matchesNode(node, component.spec))) {
        const count = expectedCounts.get(key) ?? 0;
        if (count > 0) {
          expectedCounts.set(key, count - 1);
          const tag = operationTag(node.label);
          if (tag) {
            const identityKey = `${String(node.componentName ?? "")}\u0000${tag}`;
            expectedIdentityCounts.set(identityKey, Math.max(0, (expectedIdentityCounts.get(identityKey) ?? 0) - 1));
          }
          continue;
        }
      }
      const uniqueName = node.uniqueName;
      const tag = operationTag(node.label);
      const identityKey = `${String(node.componentName ?? "")}\u0000${tag ?? ""}`;
      const matchingIdentityCount = tag ? expectedIdentityCounts.get(identityKey) ?? 0 : 0;
      if (matchingIdentityCount > 0) {
        expectedIdentityCounts.set(identityKey, matchingIdentityCount - 1);
        continue;
      }
      const previousPortalOperation = hasSourceIdentity && isPreviousPortalOperation(node.label);
      if (typeof uniqueName === "string" && tag && (managedIds.has(tag) || previousPortalOperation)) {
        staleManagedNodes.push(uniqueName);
      }
    }
    if (staleManagedNodes.length) {
      const deletion = asObject(unwrap<unknown>(await dependencies.bridge.deleteNodes({
        uniqueNames: staleManagedNodes,
      }), "talend_job_delete_managed_nodes"));
      const removed = Array.isArray(deletion?.removed)
        ? deletion.removed.filter((name): name is string => typeof name === "string")
        : [];
      if (staleManagedNodes.some((name) => !removed.includes(name))) {
        throw new Error("Studio no confirmó la eliminación de todos los nodos obsoletos del portal.");
      }
      removedComponents = removed.length;
      beforeNodes = listedNodes(unwrap<unknown>(await dependencies.bridge.listNodes(), "talend_job_list_nodes_after_delete"));
      if (staleManagedNodes.some((name) => beforeNodes.some((node) => node.uniqueName === name))) {
        throw new Error("Studio conservó nodos obsoletos después de solicitar su eliminación.");
      }
      model = await waitForActiveJob(dependencies.bridge, input.jobName, version);
    }
    for (const connection of activeConnections(model)) {
      if (typeof connection.source === "string" && typeof connection.target === "string" && typeof connection.name === "string") {
        existingEdges.add(connectionKey(
          connection.source,
          connection.target,
          connection.name,
          activeConnector(connection),
        ));
      }
    }
    const sourceInstructions = asObject(instructions?.source);
    const legacySequenceMatches = Boolean(sourceInstructions && typeof sourceInstructions.program === "string")
      && beforeNodes.length === prepared.length
      && beforeNodes.every((node, index) => {
        const expected = prepared[index];
        const uniqueName = node.uniqueName;
        return typeof uniqueName === "string"
          && node.label === uniqueName
          && expected?.spec.componentName === node.componentName;
      });
    for (const [nodeIndex, node] of beforeNodes.entries()) {
      const key = `${String(node.componentName ?? "")}\u0000${String(node.label ?? "")}`;
      const matches = expectedByKey.get(key);
      let component = matches?.shift();
      const uniqueName = node.uniqueName;
      if (!component && typeof uniqueName === "string") {
        const tag = operationTag(node.label);
        component = prepared.find((candidate) =>
          candidate.spec.componentName === node.componentName
          && operationTag(candidate.spec.label) === tag
          && !existingNames.has(candidate.spec.uniqueName));
      }
      if (!component && legacySequenceMatches) {
        const legacyMatch = prepared[nodeIndex];
        if (legacyMatch
            && legacyMatch.spec.componentName === node.componentName
            && typeof uniqueName === "string"
            && node.label === uniqueName) {
          component = legacyMatch;
          const label = legacyMatch.spec.label;
          if (label && label !== node.label) {
            unwrap(await dependencies.bridge.updateNode({
              uniqueName,
              label,
            }), "talend_job_update_node_label");
          }
        }
      }
      if (!component || typeof uniqueName !== "string" || !uniqueName) {
        throw new Error("El Job de destino contiene componentes ajenos o que no coinciden con la propuesta; no se modificó.");
      }
      if (component.spec.label && component.spec.label !== node.label) {
        unwrap(await dependencies.bridge.updateNode({
          uniqueName,
          label: component.spec.label,
        }), "talend_job_update_node_label");
      }
      existingNames.set(component.spec.uniqueName, uniqueName);
      reusedComponents++;
      if (component.parameters) {
        unwrap(await dependencies.bridge.configureNode({
          uniqueName,
          parameters: component.parameters,
        }), "talend_job_configure_node");
      }
    }

    if (contexts.length) {
      contextStats = await synchronizeContextParameters(
        dependencies.bridge,
        input.jobName,
        input.defaultContext ?? "Default",
        contexts,
        warnings,
        input.replaceManagedTodoContexts === true,
      );
    }

    for (const component of prepared) {
      if (existingNames.has(component.spec.uniqueName)) continue;
      const spec = component.spec;
      const added = asObject(unwrap<unknown>(await dependencies.bridge.addNode({
        type: spec.componentName,
        label: spec.label,
        position: { x: spec.posX ?? 128, y: spec.posY ?? 128 },
        parameters: component.parameters,
      }), "talend_job_add_node"));
      if (added?.saved === false) throw new Error(`Talend Studio no guardó ${spec.componentName}.`);
      const uniqueName = added?.uniqueName;
      if (typeof uniqueName !== "string" || !uniqueName) {
        throw new Error(`talend_job_add_node no devolvió el nombre único para ${spec.componentName}.`);
      }
      existingNames.set(spec.uniqueName, uniqueName);
      generatedComponents++;
    }

    // La conexion de Studio clona el metadata del nodo origen. Si el portal
    // aun no conoce el esquema, crea una tabla vacia (sin columnas inventadas)
    // antes de trazar los enlaces; los datos reales siguen pendientes en el
    // contexto del Job.
    for (const component of prepared) {
      if (!component.schema?.length) continue;
      const uniqueName = existingNames.get(component.spec.uniqueName);
      if (!uniqueName) continue;
      unwrap(await dependencies.bridge.configureNode({
        uniqueName,
        schema: runtimeSchema(component, uniqueName),
      }), "talend_job_configure_schema_before_connections");
    }

    const ownedNodes = new Set(existingNames.values());
    const expectedConnections = (input.connections ?? []).flatMap((connection) => {
      const source = existingNames.get(connection.source);
      const target = existingNames.get(connection.target);
      if (!source || !target) return [];
      const name = connection.label ?? connection.uniqueName ?? "";
      return {
        endpointKey: connectionEndpointKey(source, target, name),
        fullKey: connectionKey(source, target, name, connection.connectorName ?? "FLOW"),
      };
    });
    const expectedConnectionKeys = new Set(expectedConnections.map((connection) => connection.fullKey));
    const expectedEndpointKeys = new Set(expectedConnections.map((connection) => connection.endpointKey));
    for (const connection of activeConnections(model)) {
      const source = connection.source;
      const target = connection.target;
      const name = connection.name;
      if (typeof source !== "string" || typeof target !== "string" || typeof name !== "string"
          || !ownedNodes.has(source) || !ownedNodes.has(target)) {
        continue;
      }
      const endpointKey = connectionEndpointKey(source, target, name);
      const key = connectionKey(source, target, name, activeConnector(connection));
      if (expectedConnectionKeys.has(key) || !expectedEndpointKeys.has(endpointKey)) continue;
      const result = asObject(unwrap<unknown>(await dependencies.bridge.disconnectNodes({
        source,
        target,
        name,
      }), "talend_job_disconnect_nodes"));
      existingEdges.delete(key);
      removedConnections += typeof result?.count === "number" ? result.count : result?.removed === false ? 0 : 1;
    }

    for (const connection of input.connections ?? []) {
      const source = existingNames.get(connection.source);
      const target = existingNames.get(connection.target);
      if (!source || !target) {
        warnings.push(`Se omitió la conexión ${connection.source} → ${connection.target}: falta un componente validado.`);
        continue;
      }
      const label = connection.label ?? connection.uniqueName ?? "";
      const connectorName = connection.connectorName ?? "FLOW";
      const key = connectionKey(source, target, label, connectorName);
      if (existingEdges.has(key)) {
        reusedConnections++;
        continue;
      }
      unwrap(await dependencies.bridge.connectNodes({
        source,
        target,
        type: connectorName,
        name: label || undefined,
      }), "talend_job_connect_nodes");
      existingEdges.add(key);
      generatedConnections++;
    }

    // Studio asigna el uniqueName real al soltar cada nodo. Tras conectar,
    // sincroniza el schema y el mapper con esos nombres y con los rowN reales.
    for (const component of prepared) {
      if (!component.schema && !component.tables && !component.mapper) continue;
      const uniqueName = existingNames.get(component.spec.uniqueName);
      if (!uniqueName) continue;
      unwrap(await dependencies.bridge.configureNode({
        uniqueName,
        parameters: component.parameters,
        tables: component.tables,
        schema: runtimeSchema(component, uniqueName),
        mapper: component.mapper,
      }), "talend_job_configure_node_after_connections");
    }

    const afterNodes = listedNodes(unwrap<unknown>(await dependencies.bridge.listNodes(), "talend_job_list_nodes"));
    for (const component of prepared) {
      const uniqueName = existingNames.get(component.spec.uniqueName);
      const verified = uniqueName && afterNodes.some((node) => node.uniqueName === uniqueName
        && node.componentName === component.spec.componentName
        && (matchesNode(node, component.spec) || (legacySequenceMatches && node.label === node.uniqueName)));
      if (!verified) {
        throw new Error(`Studio no confirmó el componente ${component.spec.componentName} después de guardarlo.`);
      }
    }
  } catch (error) {
    if (reusedExisting) {
      throw new Error(`No se completó el Job existente; se conservó sin borrar. Puedes volver a aplicar la misma propuesta: ${String(error)}`, { cause: error });
    }
    if (createdByCall) {
      try {
        unwrap(await dependencies.bridge.deleteJob({ name: input.jobName, version }), "talend_job_delete_in_studio");
      } catch (cleanupError) {
        throw new Error(`No se pudo completar el Job y Studio tampoco pudo retirarlo: ${String(error)}; limpieza: ${String(cleanupError)}`, { cause: error });
      }
      throw new Error(`No se pudo completar el Job; Studio retiró el Job nuevo: ${String(error)}`, { cause: error });
    }
    throw error;
  }

  return {
    jobName: input.jobName,
    version,
    itemPath,
    folderPath: actualFolderPath,
    reusedExisting,
    generatedComponents,
    reusedComponents,
    generatedConnections,
    reusedConnections,
    connections: generatedConnections + reusedConnections,
    generatedContexts: contextStats.generated,
    updatedContexts: contextStats.updated,
    reusedContexts: contextStats.reused,
    removedContexts: contextStats.removed,
    removedConnections,
    removedComponents,
    totalComponents: prepared.length,
    studioApi: true,
    bridgeRefreshed: true,
    bridgeOpened: true,
    warnings,
    childJobs: [],
  };
}
