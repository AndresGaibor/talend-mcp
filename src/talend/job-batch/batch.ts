import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { buildJobItemXml, buildJobPropertiesXml, validateJobSpec, type JobSpec } from "../job-generator";
import { applyJobEdits, type JobEditOperation } from "../editor/job-edit";
import { resolveFolderDir } from "../job-crud/paths";
import { listJobs } from "../repository";
import { jobsAbiertosEnStudio } from "./open-guard";

/**
 * Operaciones masivas sobre jobs en disco: crear muchos a partir de una plantilla y editar muchos con el mismo
 * lote de operaciones. Cada job es independiente: uno que falla no impide los demas.
 */

export type BatchRow = Record<string, string | number | boolean>;

export type BatchItemResult = {
  job: string;
  ok: boolean;
  /** Para editar: si el XML cambio. Para crear: siempre true cuando se escribio. */
  changed?: boolean;
  written?: boolean;
  error?: string;
};

const PLACEHOLDER = /\{\{\s*([A-Za-z0-9_.-]+)\s*\}\}/g;

/** Sustituye `{{variable}}` en todos los textos de la plantilla. Una variable sin valor es un error. */
export function expandTemplate<T>(template: T, row: BatchRow): T {
  const missing = new Set<string>();
  const walk = (value: unknown): unknown => {
    if (typeof value === "string") {
      return value.replace(PLACEHOLDER, (_all, name: string) => {
        if (!(name in row)) {
          missing.add(name);
          return "";
        }
        return String(row[name]);
      });
    }
    if (Array.isArray(value)) return value.map(walk);
    if (value && typeof value === "object") {
      return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, walk(item)]));
    }
    return value;
  };
  const expanded = walk(template) as T;
  if (missing.size > 0) throw new Error(`Falta valor para: ${[...missing].join(", ")}`);
  return expanded;
}

/** Ejecuta `tarea` sobre todos los elementos con un maximo de `limite` a la vez. */
export async function enParalelo<T, R>(items: T[], limite: number, tarea: (item: T) => Promise<R>): Promise<R[]> {
  const resultados: R[] = new Array(items.length);
  let siguiente = 0;
  const trabajadores = Array.from({ length: Math.max(1, Math.min(limite, items.length)) }, async () => {
    while (siguiente < items.length) {
      const indice = siguiente++;
      resultados[indice] = await tarea(items[indice]!);
    }
  });
  await Promise.all(trabajadores);
  return resultados;
}

export type CreateBatchOptions = {
  projectPath: string;
  template: JobSpec;
  rows: BatchRow[];
  overwrite?: boolean;
  dryRun?: boolean;
  /** Version del componente por nombre (p. ej. del catalogo); los que no esten se escriben sin version. */
  componentVersions?: Record<string, string>;
};

/** Crea un job por fila a partir de la plantilla. Escribe `.item` y `.properties` en `process/<carpeta>`. */
export async function createJobsFromTemplate(options: CreateBatchOptions): Promise<BatchItemResult[]> {
  const { projectPath, template, rows, overwrite = false, dryRun = false, componentVersions = {} } = options;
  const names = new Set<string>();

  return await enParalelo(rows, 32, async (row): Promise<BatchItemResult> => {
    let spec: JobSpec;
    try {
      spec = expandTemplate(template, row);
      spec = {
        ...spec,
        components: spec.components.map((component) => ({
          ...component,
          componentVersion: component.componentVersion ?? componentVersions[component.componentName],
        })),
      };
    } catch (error) {
      return { job: String(row.jobName ?? template.jobName), ok: false, error: errorText(error) };
    }
    const job = spec.jobName;
    if (names.has(job)) return { job, ok: false, error: "Nombre de job repetido en el lote" };
    names.add(job);

    const validation = validateJobSpec(spec);
    if (!validation.valid) return { job, ok: false, error: validation.errors.join("; ") };

    const version = spec.version ?? "0.1";
    const folder = resolveFolderDir(projectPath, spec.folderPath);
    const itemPath = join(folder, `${job}_${version}.item`);
    if (existsSync(itemPath) && !overwrite) return { job, ok: false, error: "El job ya existe (usa overwrite)" };
    if (dryRun) return { job, ok: true, changed: true, written: false };

    try {
      const { xml, rootId } = buildJobItemXml(spec);
      mkdirSync(dirname(itemPath), { recursive: true });
      await Bun.write(itemPath, xml);
      await Bun.write(join(folder, `${job}_${version}.properties`), buildJobPropertiesXml(spec, rootId));
      return { job, ok: true, changed: true, written: true };
    } catch (error) {
      return { job, ok: false, error: errorText(error) };
    }
  });
}

export type EditBatchOptions = {
  projectPath: string;
  operations: JobEditOperation[];
  /** Nombres exactos. Si se omite, se usa `namePattern`. */
  jobs?: string[];
  /** Expresion regular sobre el nombre del job. */
  namePattern?: string;
  folderPath?: string;
  dryRun?: boolean;
  /** Editar tambien los jobs que Studio tiene abiertos en un editor (por defecto se saltan y se informa). */
  force?: boolean;
};

/** Aplica el mismo lote de operaciones a cada job elegido. Cada job es atomico por separado. */
export async function editJobsBatch(options: EditBatchOptions): Promise<{ matched: number; results: BatchItemResult[] }> {
  const { projectPath, operations, jobs, namePattern, folderPath, dryRun = false, force = false } = options;
  if (!jobs && !namePattern) throw new Error("Indica 'jobs' o 'namePattern'");
  const pattern = namePattern ? new RegExp(namePattern) : undefined;
  const wanted = jobs ? new Set(jobs) : undefined;

  const todos = await listJobs(projectPath);
  const elegidos = todos.filter((job) => {
    if (folderPath && (job.folderPath ?? "").replace(/\\/g, "/") !== folderPath) return false;
    return wanted ? wanted.has(job.label) : pattern!.test(job.label);
  });

  const abiertos = new Set(dryRun || force ? [] : await jobsAbiertosEnStudio(elegidos.map((job) => job.label)));

  const results = await enParalelo(elegidos, 32, async (job): Promise<BatchItemResult> => {
    if (abiertos.has(job.label)) {
      return { job: job.label, ok: false, error: "Abierto en un editor de Studio: se salta (cierralo o usa force)" };
    }
    try {
      const xml = await Bun.file(job.itemPath).text();
      const edited = applyJobEdits(xml, operations);
      const written = !dryRun && edited.changed;
      if (written) await Bun.write(job.itemPath, edited.xml);
      return { job: job.label, ok: true, changed: edited.changed, written };
    } catch (error) {
      return { job: job.label, ok: false, error: errorText(error) };
    }
  });
  return { matched: elegidos.length, results };
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
