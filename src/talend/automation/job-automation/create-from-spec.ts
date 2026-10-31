import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { writeTextFileAtomically } from "../../files";
import type { TalendStudioBridgeClient } from "../../studio/bridge-client";
import { buildJobItemXml, buildJobPropertiesXml, validateJobSpec, type JobSpec } from "../../job-generator";
import { inspectComponent } from "../../components/component-catalog-builder";
import { createSnapshot } from "../../sync/snapshot-manager";
import { createPlatformContext } from "../../../platform";
import { toTalendHostPath } from "../../../platform/path-bridge";
import { cerrarEditoresAbiertosPor, editoresAbiertos } from "../../studio/editores-temporales";
import { inheritSchemaFromSource } from "./schema-inheritance";
import type { CreateJobFromSpecResult, TalendJobSpec } from "./types";

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

    writeTextFileAtomically(itemPath, itemXml);
    writeTextFileAtomically(propertiesPath, propsXml);

    if (bridge) {
      const antes = await editoresAbiertos(bridge);
      try {
        const ctx = createPlatformContext();
        const studioPath = toTalendHostPath(itemPath, ctx);
        await bridge.openResource(studioPath);
        await bridge.refreshWorkspace();
      } catch {
      } finally {
        // Studio retiene ~13 MB por editor de job: el que abrio esta creacion no se queda.
        await cerrarEditoresAbiertosPor(bridge, spec.name, antes).catch(() => []);
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
