import type { TalendStudioBridgeClient } from "../../modules/studio-bridge/adapters/http-studio-bridge.client";
import { createHash } from "node:crypto";
import { clasificarProblemas, problemasDe } from "../diagnostics/output-findings";
import { customJobSpecSchema, type CustomJobSpec } from "./custom-job-spec";
import { conDialogosAtendidos } from "./dialogos-atendidos";
import { cerrarEditoresAbiertosPor, editoresAbiertos } from "./editores-temporales";

export type CustomSpecDependencies = {
  bridge: TalendStudioBridgeClient;
  listJobs: () => Promise<Array<{ label: string; version: string; folderPath?: string; description?: string; itemPath: string; propertiesPath: string }>>;
  validateConnection: (source: string, target: string, connector: string) => Promise<{ ok: boolean; errors: string[]; warnings: string[] }>;
};

function checked(result: { ok: boolean; data?: unknown; error?: { message: string } }): unknown {
  if (!result.ok) throw new Error(result.error?.message ?? "Studio rechazo la operacion");
  const data = result.data as { ok?: boolean; result?: unknown; error?: string } | undefined;
  if (data?.ok === false) throw new Error(data.error ?? "Studio rechazo la operacion");
  const payload = data?.result ?? data;
  if (payload && typeof payload === "object" && "ok" in payload && payload.ok === false) {
    throw new Error("error" in payload ? String(payload.error) : "Studio rechazo la operacion");
  }
  return payload;
}

function isMissingComponent(error: unknown, componentName: string): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes(`Componente '${componentName}' no encontrado en el catalogo de Talend`);
}

function folderOf(spec: CustomJobSpec): string {
  const folder = (spec.folderPath ?? "Process").replace(/\\/g, "/");
  const parts = folder.split("/");
  if (parts[0]?.toLowerCase() !== "process" || parts.some((part) => !part || part === "." || part === ".." || part.includes(":"))) throw new Error("La carpeta debe estar dentro de Process, sin rutas relativas");
  return parts.slice(1).join("/");
}

function existingFolderOf(job: { label: string; folderPath?: string }): string {
  const parts = (job.folderPath ?? "").replace(/\\/g, "/").split("/").filter(Boolean);
  if (parts[0]?.toLowerCase() === "process") parts.shift();
  if (parts.at(-1)?.toLowerCase() === job.label.toLowerCase()) parts.pop();
  return parts.join("/");
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)]));
  return value;
}

function ownership(spec: CustomJobSpec): string {
  return `[portal-spec:${createHash("sha256").update(JSON.stringify(canonical(spec))).digest("hex")}]`;
}

type Result = {
  jobName: string; folderPath: string; itemPath: string; propertiesPath: string;
  generatedComponents: number; reusedComponents: number; totalComponents: number;
  generatedConnections: number; reusedConnections: number; connections: number;
  generatedContexts: number; updatedContexts: number; reusedContexts: number; removedContexts: number;
  reusedExisting: boolean; componentAliases: Record<string, string>; warnings: string[]; childJobs: Result[];
  /** Problemas de diseno del job ya montado (vista Problemas); `undefined` si Studio no los dio. */
  problems?: { errors: string[]; warnings: string[]; clean: boolean };
};

/** Lee la vista Problemas tras montar, para que un nodo mal configurado se vea en la misma llamada. */
async function problemsOf(bridge: TalendStudioBridgeClient, job: string): Promise<Result["problems"]> {
  try {
    const found = clasificarProblemas(problemasDe((await bridge.jobProblems({ job })).data));
    return { errors: found.errores, warnings: found.avisos, clean: found.errores.length + found.avisos.length === 0 };
  } catch {
    return undefined;
  }
}

type SpecValidation = { warnings: string[]; unavailableDrafts: Set<string>; skippedEdges: Set<string> };

const edgeKey = (edge: { source: string; target: string }) => `${edge.source}->${edge.target}`;

/** Un tMap/tXMLMap sin mapeo no tiene tabla de salida: Studio falla al conectar desde el. */
const lacksOutputTable = (node: { componentName: string; mapper?: unknown }) =>
  /^t(XML)?Map$/i.test(node.componentName) && !node.mapper;

async function validate(spec: CustomJobSpec, deps: CustomSpecDependencies): Promise<SpecValidation> {
  folderOf(spec);
  const warnings: string[] = [];
  const unavailableDrafts = new Set<string>();
  const skippedEdges = new Set<string>();
  const components = new Map(spec.components.map((node) => [node.uniqueName, node]));
  if (components.size !== spec.components.length) throw new Error("Nombres de componentes duplicados");
  if (new Set((spec.contexts ?? []).map((context) => context.name)).size !== (spec.contexts ?? []).length) throw new Error("Nombres de contexto duplicados");
  for (const component of spec.components) {
    let metadata: { parameters?: Array<{ name: string; field?: string }> };
    try {
      metadata = checked(await deps.bridge.componentParameters({ name: component.componentName })) as typeof metadata;
    } catch (error) {
      if (!component.draftOnly || !isMissingComponent(error, component.componentName)) throw error;
      unavailableDrafts.add(component.uniqueName);
      warnings.push(
        `${component.uniqueName}: '${component.componentName}' no está en el catálogo de Studio; se omitirá este borrador y sus conexiones, y el pendiente permanecerá en el contexto del Job.`,
      );
      continue;
    }
    if (!Array.isArray(metadata?.parameters)) throw new Error(`Studio no devolvio los parametros de ${component.componentName}`);
    const names = new Set(metadata.parameters.map((parameter) => parameter.name));
    for (const name of [...Object.keys(component.parameters ?? {}), ...Object.keys(component.tables ?? {})]) {
      if (!names.has(name)) throw new Error(`Parametro '${name}' no existe en ${component.componentName}`);
    }
    for (const name of Object.keys(component.tables ?? {})) {
      if (metadata.parameters.find((parameter) => parameter.name === name)?.field !== "TABLE") throw new Error(`El parametro '${name}' no es una tabla de ${component.componentName}`);
    }
    if (component.draftOnly) warnings.push(`${component.uniqueName}: borrador; ${component.draftReason ?? "completar configuracion en Studio"}`);
  }
  for (const edge of spec.connections ?? []) {
    const source = components.get(edge.source), target = components.get(edge.target);
    if (!source || !target || source === target) throw new Error("Conexion con nodos inexistentes o con el mismo nodo");
    if (unavailableDrafts.has(edge.source) || unavailableDrafts.has(edge.target)) {
      warnings.push(`Conexión ${edge.source} → ${edge.target} no se creó porque depende de un borrador ausente en Studio.`);
      continue;
    }
    if (["SUBJOB_OK", "SUBJOB_ERROR", "COMPONENT_OK", "COMPONENT_ERROR"].includes(edge.connectorName ?? "")) continue;
    if (lacksOutputTable(source)) {
      skippedEdges.add(edgeKey(edge));
      warnings.push(`Conexión ${edge.source} → ${edge.target} no se creó porque ${edge.source} es un ${source.componentName} sin mapeo de salida; conéctalo en Studio al configurar el mapeo.`);
      continue;
    }
    if (edge.connectorName === "RUN_IF") throw new Error("RUN_IF necesita una condicion explicita; no se inventa una condicion");
    const check = await deps.validateConnection(source.componentName, target.componentName, edge.connectorName ?? "FLOW");
    if (!check.ok) throw new Error(check.errors.join(". "));
    warnings.push(...check.warnings);
  }
  return { warnings, unavailableDrafts, skippedEdges };
}

/** Si la aplicacion falla, deshace los Jobs que se crearon en esta llamada (nunca los que ya existian). */
async function rollbackCreated(bridge: TalendStudioBridgeClient, created: CustomJobSpec[], cause: unknown): Promise<Error> {
  const error = cause instanceof Error ? cause : new Error(String(cause));
  if (!created.length) return error;
  const undone: string[] = [];
  const stuck: string[] = [];
  for (const job of [...created].reverse()) {
    try {
      checked(await bridge.deleteJob({ name: job.jobName, version: job.version ?? "0.1" }));
      undone.push(job.jobName);
    } catch {
      stuck.push(job.jobName);
    }
  }
  const notes = [
    undone.length ? `Se revirtió la creación de: ${undone.join(", ")}.` : "",
    stuck.length ? `No se pudo borrar y debe revisarse en Studio: ${stuck.join(", ")}.` : "",
  ].filter(Boolean).join(" ");
  return new Error(`${error.message}. ${notes}`);
}

// Un montaje cambia el editor activo: no se intercalan dos montajes custom.
let applying = false;
export async function applyCustomJobSpec(input: CustomJobSpec, deps: CustomSpecDependencies): Promise<Result> {
  if (applying) throw new Error("Studio ocupado con otro montaje custom; reintenta al terminar");
  applying = true;
  try {
    const spec = customJobSpecSchema.parse(input);
    const forest: CustomJobSpec[] = [];
    const byName = new Map<string, CustomJobSpec>();
    const visit = (job: CustomJobSpec, depth: number) => {
      if (depth > 16 || forest.length > 100) throw new Error("El montaje excede el limite de Jobs hijos");
      const old = byName.get(job.jobName.toLowerCase());
      if (old && ownership(old) !== ownership(job)) throw new Error(`CONFLICT: ${job.jobName} aparece con dos definiciones o carpetas diferentes`);
      if (old) return;
      byName.set(job.jobName.toLowerCase(), job);
      for (const child of job.childJobs ?? []) visit(child, depth + 1);
      forest.push(job);
    };
    visit(spec, 0);
    const validations = new Map<CustomJobSpec, SpecValidation>();
    // Se comprueba todo el arbol y todos los destinos antes de crear el primer Job.
    const existingJobs = await deps.listJobs();
    for (const job of forest) {
      validations.set(job, await validate(job, deps));
      const existing = existingJobs.filter((item) => item.label.toLowerCase() === job.jobName.toLowerCase());
      if (existing.length && (existing.length !== 1 || existing[0]!.version !== (job.version ?? "0.1") || existingFolderOf(existing[0]!) !== folderOf(job) || !existing[0]!.description?.includes(ownership(job)))) throw new Error(`CONFLICT: ya existe ${job.jobName} y no pertenece a esta especificacion; no se sobrescribe`);
    }
    const results = new Map<string, Result>();
    const created: CustomJobSpec[] = [];
    try {
      for (const job of forest) {
        const bridge = deps.bridge;
        const editoresAntes = await editoresAbiertos(bridge);
        const previous = existingJobs.find((item) => item.label === job.jobName);
        if (previous) checked(await bridge.openJob({ name: job.jobName, version: job.version ?? "0.1" }));
        else { checked(await bridge.createJob({ name: job.jobName, version: job.version ?? "0.1", folder: folderOf(job), description: `${job.description ?? ""}\n${ownership(job)}`, replace: false })); created.push(job); }
        const savedJob = (await deps.listJobs()).find((item) => item.label === job.jobName);
        if (!savedJob || existingFolderOf(savedJob) !== folderOf(job)) throw new Error(`Studio no confirmo el destino de ${job.jobName}`);
        const result: Result = { jobName: job.jobName, folderPath: job.folderPath ?? "Process", itemPath: savedJob.itemPath, propertiesPath: savedJob.propertiesPath,
          generatedComponents: 0, reusedComponents: 0, totalComponents: job.components.length, generatedConnections: 0, reusedConnections: 0, connections: (job.connections ?? []).length,
          generatedContexts: 0, updatedContexts: 0, reusedContexts: 0, removedContexts: 0, reusedExisting: Boolean(previous), componentAliases: {}, warnings: validations.get(job)?.warnings ?? [], childJobs: (job.childJobs ?? []).map((child) => results.get(child.jobName)!) };
        const nodes = checked(await bridge.listNodes({ job: job.jobName })) as Array<{ uniqueName: string; label?: string; componentName?: string }>;
        if (!Array.isArray(nodes)) throw new Error("Studio no devolvio la lista de nodos");
        const newNodes = new Set<string>();
        for (const component of job.components) {
          if (validations.get(job)?.unavailableDrafts.has(component.uniqueName)) continue;
          const marker = `[portal:${component.uniqueName}]`;
          const matches = nodes.filter((node) => node.label?.endsWith(marker));
          if (matches.length > 1 || (matches[0] && matches[0].componentName !== component.componentName)) throw new Error(`CONFLICT: nodo ${component.uniqueName} ambiguo o de otro componente`);
          let actual = matches[0]?.uniqueName;
          if (!actual) {
            const added = checked(await bridge.addNode({ job: job.jobName, type: component.componentName, label: `${component.label ?? component.uniqueName} ${marker}`, position: { x: component.posX ?? 160, y: component.posY ?? 96 }, parameters: Object.fromEntries(Object.entries(component.parameters ?? {}).map(([name, value]) => [name, { value }])), schema: component.schema ? [{ ...component.schema }] : undefined })) as { uniqueName?: string; saved?: boolean };
            if (!added?.uniqueName || added.saved === false) throw new Error(`Studio no confirmo el nodo ${component.uniqueName}`);
            actual = added.uniqueName; result.generatedComponents++; newNodes.add(component.uniqueName);
          } else result.reusedComponents++;
          result.componentAliases[component.uniqueName] = actual;
        }
        const model = checked(await bridge.activeJobModel()) as { connections?: Array<{ source?: string; target?: string; connectorName?: string }> };
        if (!Array.isArray(model?.connections)) throw new Error("Studio no permite comprobar las conexiones existentes");
        for (const edge of job.connections ?? []) {
          if (validations.get(job)?.unavailableDrafts.has(edge.source) || validations.get(job)?.unavailableDrafts.has(edge.target)) continue;
          if (validations.get(job)?.skippedEdges.has(edgeKey(edge))) continue;
          const source = result.componentAliases[edge.source]!, target = result.componentAliases[edge.target]!;
          const connector = edge.connectorName ?? "FLOW";
          const existing = model.connections.filter((item) => item.source === source && item.target === target);
          if (existing.some((item) => item.connectorName !== connector)) throw new Error(`CONFLICT: conexion ${edge.source} -> ${edge.target} modificada; no se sustituye`);
          if (existing.length) { result.reusedConnections++; continue; }
          const connected = checked(await conDialogosAtendidos(bridge, () => bridge.connectNodes({ job: job.jobName, source, target, type: connector, name: edge.label }))) as { warnings?: string[] };
          result.warnings.push(...(connected?.warnings ?? [])); result.generatedConnections++;
          model.connections.push({ source, target, connectorName: connector });
        }
        // Studio propaga schemas al conectar. Se termina la configuracion despues,
        // sin reconfigurar los nodos que una persona ya pudo haber corregido.
        for (const component of [...job.components].reverse()) {
          if (validations.get(job)?.unavailableDrafts.has(component.uniqueName)) continue;
          if (!newNodes.has(component.uniqueName) || (!component.schema && !component.tables && !component.mapper)) continue;
          checked(await bridge.configureNode({ job: job.jobName, uniqueName: result.componentAliases[component.uniqueName]!, schema: component.schema ? [{ ...component.schema }] : undefined, tables: component.tables, mapper: component.mapper }));
        }
        const contexts = checked(await bridge.jobContexts({ job: job.jobName })) as { contexts?: Array<{ name: string; parameters: Array<{ name: string; type?: string; value: string }> }> };
        if (!Array.isArray(contexts?.contexts)) throw new Error("Studio no devolvio los contextos del Job");
        const environment = job.defaultContext ?? "Default";
        let context = contexts.contexts.find((item) => item.name === environment);
        if (!context) {
          checked(await bridge.createJobContext({ job: job.jobName, name: environment }));
          const refreshed = checked(await bridge.jobContexts({ job: job.jobName })) as typeof contexts;
          context = refreshed.contexts?.find((item) => item.name === environment);
          if (!context) throw new Error(`Studio no confirmo el contexto ${environment}`);
        }
        const names = new Set((job.contexts ?? []).map((item) => item.name));
        for (const variable of job.contexts ?? []) {
          const current = context.parameters.find((item) => item.name === variable.name);
          if (current?.value) { result.reusedContexts++; continue; }
          if (current && current.value === variable.value) { result.reusedContexts++; continue; }
          checked(await bridge.setJobContextParameter({ job: job.jobName, context: environment, ...variable }));
          if (current) result.updatedContexts++; else result.generatedContexts++;
        }
        if (job.replaceManagedTodoContexts) for (const variable of context.parameters) {
          if (/^migration_todo_[a-f0-9]{12}$/.test(variable.name) && !variable.value && !names.has(variable.name)) {
            checked(await bridge.deleteJobContextParameter({ job: job.jobName, context: environment, name: variable.name })); result.removedContexts++;
          }
        }
        result.problems = await problemsOf(bridge, job.jobName);
        results.set(job.jobName, result);
        // El Job ya esta guardado: su editor sobra y, acumulado en un lote, satura Studio.
        await cerrarEditoresAbiertosPor(bridge, job.jobName, editoresAntes);
      }
    } catch (error) {
      throw await rollbackCreated(deps.bridge, created, error);
    }
    return results.get(spec.jobName)!;
  } finally { applying = false; }
}
