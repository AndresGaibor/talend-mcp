import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { TalendStudioBridgeClient } from "../studio/bridge-client";
import { buildJobItemXml, buildJobPropertiesXml, validateJobSpec, type JobSpec } from "../job-generator";
import { inspectComponent } from "../components/component-catalog-builder";
import { createSnapshot } from "../sync/snapshot-manager";
import { createPlatformContext } from "../../platform";
import { toTalendHostPath } from "../../platform/path-bridge";

export type TalendJobSpec = {
  name: string;
  version: string;
  folder?: string;
  description?: string;
  components: Array<{
    id: string;
    type: string;
    label?: string;
    position?: { x: number; y: number };
    parameters?: Record<string, string | { value: string; field?: string }>;
    schema?: Array<{
      name: string;
      type: string;
      nullable?: boolean;
      length?: number;
      precision?: number;
    }>;
  }>;
  connections: Array<{
    name: string;
    source: string;
    target: string;
    type: "FLOW" | "ITERATE" | "REJECT" | "LOOKUP";
    label?: string;
  }>;
  contexts?: Record<string, Record<string, string>>;
};

export type CreateJobFromSpecResult = {
  ok: boolean;
  jobName: string;
  folderPath: string;
  itemPath: string | null;
  propertiesPath: string | null;
  errors: string[];
};

/**
 * Schema que un componente recibe del flujo, si no declara el suyo.
 *
 * Un `tLogRow` al final de un flujo no declara schema, pero Talend si lo
 * necesita: el parametro `LENGTHS` se arma con las columnas que le llegan.
 * Sin schema, el job falla al generar codigo con `NumberFormatException`.
 */
function inheritSchemaFromSource(
  componentId: string,
  spec: TalendJobSpec,
): { name: string; connector: string; columns: Array<{ name: string; type: string; nullable?: boolean; length?: number; precision?: number }> } | undefined {
  const incoming = spec.connections.filter((c) => c.target === componentId && c.type === "FLOW");
  for (const connection of incoming) {
    const source = spec.components.find((c) => c.id === connection.source);
    if (!source?.schema || source.schema.length === 0) {
      continue;
    }
    return {
      // El metadata del componente que hereda el schema se llama como el
      // componente, no como la primera columna.
      name: componentId,
      connector: "FLOW",
      columns: source.schema.map((col) => ({
        name: col.name,
        type: col.type,
        nullable: col.nullable,
        length: col.length,
        precision: col.precision,
      })),
    };
  }
  return undefined;
}
export async function createJobFromSpec(
  projectPath: string,
  spec: TalendJobSpec,
  bridge?: TalendStudioBridgeClient,
): Promise<CreateJobFromSpecResult> {
  const errors: string[] = [];
  const componentVersions = new Map<string, string>();

  for (const comp of spec.components) {
    const catalogEntry = await inspectComponent(comp.type);
    if (!catalogEntry) {
      errors.push("Componente '" + comp.type + "' no encontrado en catalogo");
    } else if (catalogEntry.version) {
      // Studio necesita la version del componente para resolverlo al ejecutar.
      componentVersions.set(comp.id, catalogEntry.version);
    }
  }

  if (errors.length > 0) {
    return { ok: false, jobName: spec.name, folderPath: spec.folder ?? "", itemPath: null, propertiesPath: null, errors };
  }

  const jobSpec: JobSpec = {
    jobName: spec.name,
    version: spec.version,
    folderPath: spec.folder,
    description: spec.description,
    components: spec.components.map((c) => ({
      componentName: c.type,
      uniqueName: c.id,
      componentVersion: componentVersions.get(c.id),
      label: c.label,
      posX: c.position?.x ?? 160,
      posY: c.position?.y ?? 96,
      parameters: c.parameters ?? {},
      schema: c.schema
        ? {
            // El metadata se llama como el componente, no como la primera
            // columna. Asi lo escribe el propio Studio.
            name: c.id,
            connector: "FLOW",
            columns: c.schema.map((col) => ({
              name: col.name,
              type: col.type,
              nullable: col.nullable,
              length: col.length,
              precision: col.precision,
            })),
          }
        : inheritSchemaFromSource(c.id, spec),
    })),
    connections: spec.connections.map((c) => ({
      source: c.source,
      target: c.target,
      label: c.label ?? "",
      connectorName: c.type,
      uniqueName: c.name,
    })),
  };

  const validation = validateJobSpec(jobSpec);
  if (!validation.valid) {
    return { ok: false, jobName: spec.name, folderPath: spec.folder ?? "", itemPath: null, propertiesPath: null, errors: validation.errors };
  }

  try {
    const processDir = join(projectPath, "process");
    let targetDir = processDir;
    if (spec.folder) {
      targetDir = join(processDir, ...spec.folder.split("/"));
      if (!existsSync(targetDir)) {
        mkdirSync(targetDir, { recursive: true });
      }
    }

    const itemFileName = spec.name + "_" + spec.version + ".item";
    const propsFileName = spec.name + "_" + spec.version + ".properties";
    const itemPath = join(targetDir, itemFileName);
    const propertiesPath = join(targetDir, propsFileName);

    const catalogSpec: JobSpec = {
      jobName: spec.name,
      version: spec.version,
      folderPath: spec.folder,
      components: jobSpec.components,
      connections: jobSpec.connections,
    };

    const { xml: itemXml, rootId } = buildJobItemXml(catalogSpec);
    const propsXml = buildJobPropertiesXml(catalogSpec, rootId);

    if (existsSync(itemPath)) {
      await createSnapshot(projectPath, itemPath, propertiesPath, "create_job_from_spec");
    }

    writeFileSync(itemPath, itemXml, "utf8");
    writeFileSync(propertiesPath, propsXml, "utf8");

    if (bridge) {
      try {
        const ctx = createPlatformContext();
        const studioPath = toTalendHostPath(itemPath, ctx);
        await bridge.openResource(studioPath);
        await bridge.refreshWorkspace();
      } catch {
      }
    }

    return {
      ok: true,
      jobName: spec.name,
      folderPath: spec.folder ?? "",
      itemPath,
      propertiesPath,
      errors: [],
    };
  } catch (e) {
    return { ok: false, jobName: spec.name, folderPath: spec.folder ?? "", itemPath: null, propertiesPath: null, errors: [e instanceof Error ? e.message : String(e)] };
  }
}

export async function validateJobAutomation(
  projectPath: string,
  jobName: string,
  bridge?: TalendStudioBridgeClient,
): Promise<{ ok: boolean; problemsCount: number; errors: string[] }> {
  if (!bridge) {
    return { ok: false, problemsCount: 0, errors: ["Bridge no disponible"] };
  }

  try {
    const modelResult = await bridge.activeJobModel();
    if (!modelResult.ok) {
      return { ok: false, problemsCount: 0, errors: ["No se pudo obtener el modelo del job"] };
    }

    const problemsResult = await bridge.problemsMarkers();
    const problemsCount = problemsResult.ok ? ((problemsResult.data as any)?.markers?.length ?? 0) : 0;

    return { ok: true, problemsCount, errors: [] };
  } catch (e) {
    return { ok: false, problemsCount: 0, errors: [e instanceof Error ? e.message : String(e)] };
  }
}

export async function runJobAutomation(
  projectPath: string,
  jobName: string,
  bridge?: TalendStudioBridgeClient,
  options?: {
    unsafeActions?: boolean;
    contextName?: string;
    waitForTermination?: boolean;
    timeoutMs?: number;
  },
): Promise<{ ok: boolean; exitCode?: number; durationMs?: number; output?: string; errors: string[] }> {
  const errors: string[] = [];

  if (!bridge) {
    return { ok: false, errors: ["Bridge no disponible"] };
  }

  try {
    const saveResult = await bridge.saveAllEditors();
    if (!saveResult.ok) {
      errors.push("No se pudo guardar el editor activo");
    }

    await bridge.refreshWorkspace();

    const validate = await validateJobAutomation(projectPath, jobName, bridge);
    if (validate.problemsCount > 0) {
      errors.push("El job tiene " + validate.problemsCount + " problemas antes de ejecutar");
    }

    const runResult = await bridge.runActiveJob({
      dryRun: !(options?.unsafeActions ?? false),
      saveBefore: true,
      waitForTermination: options?.waitForTermination ?? false,
      timeoutMs: options?.timeoutMs ?? 60_000,
    });

    return {
      ok: runResult.ok,
      exitCode: (runResult.data as any)?.exitCode,
      durationMs: (runResult.data as any)?.durationMs,
      output: (runResult.data as any)?.output,
      errors,
    };
  } catch (e) {
    return { ok: false, errors: [e instanceof Error ? e.message : String(e)] };
  }
}
