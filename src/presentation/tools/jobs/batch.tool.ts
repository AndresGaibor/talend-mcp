import { z } from "zod/v4";
import { jobEditOperationSchema } from "../../../talend/editor/job-edit";
import { inspectComponent } from "../../../talend/components/component-catalog-builder";
import { createJobsFromTemplate, editJobsBatch, type BatchItemResult } from "../../../talend/job-batch/batch";
import { resolveProjectPath } from "../../../talend/workspace";
import { okResult, errorResult } from "../common/result";

const TRAMO_DE_CONSTRUCCION = 500;

const rowSchema = z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]));

const columnSchema = z.object({
  name: z.string().min(1),
  type: z.string().optional(),
  length: z.number().int().optional(),
  precision: z.number().int().optional(),
  nullable: z.boolean().optional(),
  key: z.boolean().optional(),
});

const templateSchema = z.object({
  jobName: z.string().min(1).describe("Nombre del job; admite variables, p. ej. MIG_{{tabla}}"),
  version: z.string().optional(),
  folderPath: z.string().optional().describe("Carpeta dentro de process/"),
  description: z.string().optional(),
  components: z.array(z.object({
    uniqueName: z.string().min(1),
    componentName: z.string().min(1),
    componentVersion: z.string().optional(),
    label: z.string().optional(),
    posX: z.number().optional(),
    posY: z.number().optional(),
    parameters: z.record(z.string(), z.union([z.string(), z.object({ value: z.string(), field: z.string().optional() })])).optional(),
    schema: z.object({ name: z.string(), connector: z.string().optional(), columns: z.array(columnSchema) }).optional(),
  })).min(1),
  connections: z.array(z.object({
    source: z.string(),
    target: z.string(),
    label: z.string(),
    connectorName: z.string().optional(),
    metaname: z.string().optional(),
    uniqueName: z.string().optional(),
  })).optional(),
  contexts: z.array(z.object({ name: z.string(), type: z.string(), value: z.string(), comment: z.string().optional() })).optional(),
});

/** Refresca Studio y construye (genera + compila) los jobs, por tramos. Devuelve el resultado por job. */
async function construir(jobs: string[], parallelism: number): Promise<Record<string, { ok: boolean; error?: unknown }>> {
  const { createBridgeClient } = await import("../../../modules/studio-bridge/adapters/http-studio-bridge.client");
  const bridge = await createBridgeClient({ config: { timeoutMs: 900_000 } });
  await bridge.refreshWorkspace();
  const todos: Record<string, { ok: boolean; error?: unknown }> = {};
  for (let i = 0; i < jobs.length; i += TRAMO_DE_CONSTRUCCION) {
    const tramo = jobs.slice(i, i + TRAMO_DE_CONSTRUCCION);
    const respuesta = await bridge.jobBuildBatch({ jobs: tramo, parallelism });
    if (!respuesta.ok) {
      for (const job of tramo) todos[job] = { ok: false, error: respuesta.error?.message ?? "El bridge no respondio" };
      continue;
    }
    const resultado = (respuesta.data as { result?: { jobs?: Record<string, { ok: boolean; error?: unknown }> } } | undefined)
      ?.result?.jobs ?? {};
    Object.assign(todos, resultado);
  }
  return todos;
}

function resumen(results: BatchItemResult[], compilacion?: Record<string, { ok: boolean; error?: unknown }>) {
  const fallos = results.filter((r) => !r.ok).map((r) => ({ job: r.job, error: r.error }));
  const noCompilan = compilacion
    ? Object.entries(compilacion).filter(([, r]) => !r.ok).map(([job, r]) => ({ job, error: r.error }))
    : undefined;
  return {
    total: results.length,
    correctos: results.length - fallos.length,
    escritos: results.filter((r) => r.written).length,
    fallos: fallos.slice(0, 50),
    ...(compilacion
      ? { compilan: Object.values(compilacion).filter((r) => r.ok).length, noCompilan: noCompilan!.slice(0, 50) }
      : {}),
  };
}

const CreateBatchSchema = z.object({
  template: templateSchema.describe("Plantilla del job. Los textos admiten {{variable}}"),
  rows: z.array(rowSchema).min(1).max(20000).describe("Una fila por job: valores de las variables de la plantilla"),
  overwrite: z.boolean().optional().default(false).describe("Sobrescribir los jobs que ya existen"),
  dryRun: z.boolean().optional().default(false).describe("Validar sin escribir"),
  verify: z.boolean().optional().default(false).describe("Refrescar Studio y compilar cada job creado (necesita Studio abierto)"),
  parallelism: z.number().int().min(1).max(16).optional().default(4),
});

export function createJobsCreateBatchTool() {
  return {
    name: "talend_jobs_create_batch",
    description:
      "Crea MUCHOS jobs a la vez, sin Studio, a partir de una plantilla con {{variables}} y una fila de valores por job (hasta 20000). Escribe los .item y .properties en disco en milisegundos. Con verify:true refresca Studio y compila cada job sin abrir su editor (~0,2 s por job), y devuelve cuales no compilan. Pensada para migraciones masivas.",
    inputSchema: CreateBatchSchema,
    annotations: { readOnly: false, requiresConfirmation: true },
    handler: async (input: z.infer<typeof CreateBatchSchema>) => {
      const tool = "jobs-create-batch";
      try {
        const projectPath = await resolveProjectPath();
        if (!projectPath) return errorResult(tool, "NO_PROJECT", "No se pudo detectar el proyecto Talend. Define TALEND_PROJECT.");

        const componentVersions: Record<string, string> = {};
        for (const nombre of new Set(input.template.components.map((c) => c.componentName))) {
          const entrada = await inspectComponent(nombre);
          if (!entrada) return errorResult(tool, "UNKNOWN_COMPONENT", `Componente '${nombre}' no encontrado en el catalogo`);
          if (entrada.version) componentVersions[nombre] = entrada.version;
        }

        const inicio = Date.now();
        const results = await createJobsFromTemplate({
          projectPath,
          template: input.template,
          rows: input.rows,
          overwrite: input.overwrite,
          dryRun: input.dryRun,
          componentVersions,
        });
        const escritosMs = Date.now() - inicio;

        let compilacion: Record<string, { ok: boolean; error?: unknown }> | undefined;
        if (input.verify && !input.dryRun) {
          const aConstruir = results.filter((r) => r.written).map((r) => r.job);
          try {
            compilacion = await construir(aConstruir, input.parallelism);
          } catch (error) {
            return errorResult(tool, "BUILD_UNAVAILABLE", `Jobs escritos, pero no se pudo compilar: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
        return okResult({ ...resumen(results, compilacion), escrituraMs: escritosMs }, tool);
      } catch (error) {
        return errorResult(tool, "CREATE_BATCH_ERROR", error instanceof Error ? error.message : String(error));
      }
    },
  };
}

const EditBatchSchema = z.object({
  jobs: z.array(z.string().min(1)).max(20000).optional().describe("Nombres exactos de los jobs"),
  namePattern: z.string().optional().describe("Expresion regular sobre el nombre del job, p. ej. ^MIG_"),
  folderPath: z.string().optional().describe("Limitar a una carpeta de process/"),
  operations: z.array(jobEditOperationSchema).min(1).max(200),
  dryRun: z.boolean().optional().default(false),
  verify: z.boolean().optional().default(false).describe("Refrescar Studio y compilar los jobs modificados"),
  parallelism: z.number().int().min(1).max(16).optional().default(4),
});

export function createJobsEditBatchTool() {
  return {
    name: "talend_jobs_edit_batch",
    description:
      "Aplica el MISMO lote de operaciones (add_node, set_params, set_schema, connect...) a muchos jobs a la vez, directamente en disco y sin Studio. Eliges los jobs por lista de nombres o por expresion regular. Cada job es atomico por separado: el que falle la integridad no se toca y se informa, los demas se escriben. Con verify:true compila los modificados.",
    inputSchema: EditBatchSchema,
    annotations: { readOnly: false, requiresConfirmation: true },
    handler: async (input: z.infer<typeof EditBatchSchema>) => {
      const tool = "jobs-edit-batch";
      try {
        if (!input.jobs && !input.namePattern) return errorResult(tool, "INVALID_INPUT", "Indica 'jobs' o 'namePattern'.");
        const projectPath = await resolveProjectPath();
        if (!projectPath) return errorResult(tool, "NO_PROJECT", "No se pudo detectar el proyecto Talend. Define TALEND_PROJECT.");

        const inicio = Date.now();
        const { matched, results } = await editJobsBatch({
          projectPath,
          operations: input.operations,
          jobs: input.jobs,
          namePattern: input.namePattern,
          folderPath: input.folderPath,
          dryRun: input.dryRun,
        });
        const edicionMs = Date.now() - inicio;
        if (matched === 0) return errorResult(tool, "NO_MATCH", "Ningun job coincide con la seleccion.");

        let compilacion: Record<string, { ok: boolean; error?: unknown }> | undefined;
        if (input.verify && !input.dryRun) {
          try {
            compilacion = await construir(results.filter((r) => r.written).map((r) => r.job), input.parallelism);
          } catch (error) {
            return errorResult(tool, "BUILD_UNAVAILABLE", `Jobs editados, pero no se pudo compilar: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
        return okResult({ ...resumen(results, compilacion), sinCambios: results.filter((r) => r.ok && !r.changed).length, edicionMs }, tool);
      } catch (error) {
        return errorResult(tool, "EDIT_BATCH_ERROR", error instanceof Error ? error.message : String(error));
      }
    },
  };
}
