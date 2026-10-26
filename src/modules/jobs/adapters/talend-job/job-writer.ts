import { TalendStudioBridgeClient } from "../../../studio-bridge/adapters/http-studio-bridge.client";
import type { CreateJobOptions, Job } from "../../domain/job.types";
import { findJobById, findJobByName } from "./job-reader";
import { folderOf } from "./project-path";

/**
 * Crea un job en el proyecto, con la API de Studio.
 *
 * `options.path` es la carpeta dentro de `process` donde va el job.
 */
export async function createJob(options: CreateJobOptions): Promise<Job> {
  const bridge = await TalendStudioBridgeClient.create();
  const result = await bridge.createJob({
    name: options.name,
    folder: folderOf(options.path),
    description: options.description,
  });
  if (!result.ok) {
    throw new Error(result.error?.message ?? "Studio no pudo crear el job");
  }

  const job = await findJobByName(options.name);
  if (!job) {
    throw new Error(`El job '${options.name}' se creo pero no aparece en el proyecto`);
  }
  return job;
}

/**
 * Aplica los cambios de un job, con la API de Studio.
 *
 * Se reconfiguran los componentes que tengan parametros: cada cambio se
 * manda a Studio, que es quien los guarda.
 */
export async function updateJob(job: Job): Promise<Job> {
  const bridge = await TalendStudioBridgeClient.create();
  for (const component of job.components) {
    const parameters: Record<string, { value: string }> = {};
    for (const [nombre, valor] of Object.entries(component.configuration ?? {})) {
      if (valor === undefined || valor === null) continue;
      parameters[nombre] = { value: typeof valor === "string" ? valor : JSON.stringify(valor) };
    }
    if (Object.keys(parameters).length === 0) continue;

    const result = await bridge.configureNode({
      job: job.name,
      uniqueName: component.id,
      parameters,
    });
    if (!result.ok) {
      throw new Error(
        `No se pudo configurar '${component.id}' del job '${job.name}': ` +
          (result.error?.message ?? "error desconocido"),
      );
    }
  }
  return (await findJobById(job.id)) ?? job;
}

/** Borra un job del proyecto, con la API de Studio. */
export async function deleteJob(id: string): Promise<void> {
  const job = await findJobById(id);
  if (!job) {
    throw new Error(`No existe el job '${id}'`);
  }
  const bridge = await TalendStudioBridgeClient.create();
  const result = await bridge.deleteJob({ name: job.name, version: job.version });
  if (!result.ok) {
    throw new Error(result.error?.message ?? "Studio no pudo borrar el job");
  }
}
