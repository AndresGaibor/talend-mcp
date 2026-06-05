import * as z from "zod/v4";
import { join } from "node:path";
import { bridgeOk, bridgeFail, loadBridge } from "./tools-base";
import { generateJobSpec, validateJobSpec } from "../jobs/pipeline-patterns";
import { toGeneratorSpec, validateGeneratorSpec } from "../jobs/job-spec-generator";
import { buildJobItemXml, buildJobPropertiesXml } from "../job-generator";
import { writeTextFile } from "../files";
import { getConfiguredProjectPath } from "../workspace";
import { listJobs } from "../repository";
import { createPlatformContext } from "../../platform";
import { toTalendHostPath } from "../../platform/path-bridge";
import type { PatrónTalend } from "../task/task-types";

async function findExistingJob(projectPath: string, jobName: string): Promise<{ itemPath: string; propertiesPath: string } | null> {
  try {
    const jobs = await listJobs(projectPath);
    const matches = jobs.filter((j) => j.label === jobName);
    if (matches.length === 1) {
      return { itemPath: matches[0]!.itemPath, propertiesPath: matches[0]!.propertiesPath };
    }
    return null;
  } catch {
    return null;
  }
}

export const jobSpecTools = [
  {
    name: "talend_job_validate_pipeline_spec",
    description: "Valida una especificación de pipeline antes de generar el job.",
    inputSchema: z.object({
      spec: z.record(z.string(), z.unknown()).describe("Especificación del pipeline"),
    }),
    handler: async (input: { spec: Record<string, unknown> }) => {
      try {
        const result = validateJobSpec(input.spec as unknown as Parameters<typeof validateJobSpec>[0]);
        return bridgeOk({
          ok: result.valid,
          source: "job-spec",
          confidence: result.valid ? "high" : "high",
          endpoint: "/job/validate-pipeline-spec",
          data: result,
        });
      } catch (err) {
        return bridgeFail({
          ok: false,
          source: "job-spec",
          confidence: "low",
          endpoint: "/job/validate-pipeline-spec",
          error: { code: "VALIDATION_FAILED", message: String(err) },
        });
      }
    },
  },
  {
    name: "talend_job_preview_pipeline_spec",
    description: "Previsualiza cómo quedaría un pipeline.sin generar el job en Talend.",
    inputSchema: z.object({
      pattern: z.enum(["multi_csv_raw_loader", "csv_to_db_with_audit_columns", "sql_orchestration_job", "db_to_db_copy", "api_to_db_loader", "file_watcher_pipeline"]).describe("Patrón del pipeline"),
      name: z.string().describe("Nombre del job"),
      inputPath: z.string().optional().describe("Ruta de entrada"),
      outputTable: z.string().optional().describe("Tabla de salida"),
      batchSize: z.number().optional().describe("Batch size"),
      auditColumns: z.boolean().optional().default(true).describe("Incluir columnas de audit"),
    }),
    handler: async (input: { pattern: PatrónTalend; name: string; inputPath?: string; outputTable?: string; batchSize?: number; auditColumns?: boolean }) => {
      try {
        const spec = generateJobSpec(input.pattern, input.name, {
          inputPath: input.inputPath,
          outputTable: input.outputTable,
          batchSize: input.batchSize,
          auditColumns: input.auditColumns,
        });
        return bridgeOk({
          ok: true,
          source: "job-spec",
          confidence: "high",
          endpoint: "/job/preview-pipeline-spec",
          data: { spec },
        });
      } catch (err) {
        return bridgeFail({
          ok: false,
          source: "job-spec",
          confidence: "low",
          endpoint: "/job/preview-pipeline-spec",
          error: { code: "PREVIEW_FAILED", message: String(err) },
        });
      }
    },
  },
  {
    name: "talend_job_generate_from_pipeline_spec",
    description: "Genera un job de Talend a partir de una especificación de pipeline.",
    inputSchema: z.object({
      pattern: z.enum(["multi_csv_raw_loader", "csv_to_db_with_audit_columns", "sql_orchestration_job", "db_to_db_copy", "api_to_db_loader", "file_watcher_pipeline"]).describe("Patrón del pipeline"),
      name: z.string().describe("Nombre del job a generar"),
      inputPath: z.string().optional().describe("Ruta de entrada de archivos"),
      outputTable: z.string().optional().describe("Tabla de base de datos destino"),
      batchSize: z.number().optional().describe("Batch size para inserts"),
      auditColumns: z.boolean().optional().default(true).describe("Usar columnas de audit"),
    }),
    handler: async (input: { pattern: PatrónTalend; name: string; inputPath?: string; outputTable?: string; batchSize?: number; auditColumns?: boolean }) => {
      try {
        const spec = generateJobSpec(input.pattern, input.name, {
          inputPath: input.inputPath,
          outputTable: input.outputTable,
          batchSize: input.batchSize,
          auditColumns: input.auditColumns,
        });

        const validation = validateJobSpec(spec);

        return bridgeOk({
          ok: validation.valid,
          source: "job-spec",
          confidence: "high",
          endpoint: "/job/generate-from-pipeline-spec",
          data: {
            generated: true,
            spec,
            validation,
          },
        });
      } catch (err) {
        return bridgeFail({
          ok: false,
          source: "job-spec",
          confidence: "low",
          endpoint: "/job/generate-from-pipeline-spec",
          error: { code: "GENERATION_FAILED", message: String(err) },
        });
      }
    },
  },
  {
    name: "talend_job_apply_pipeline_spec",
    description: "Genera y escribe archivos .item y .properties reales en el proyecto Talend.",
    inputSchema: z.object({
      pattern: z.enum(["multi_csv_raw_loader", "csv_to_db_with_audit_columns", "sql_orchestration_job", "db_to_db_copy", "api_to_db_loader", "file_watcher_pipeline"]).describe("Patrón del pipeline"),
      name: z.string().describe("Nombre del job"),
      inputPath: z.string().optional().describe("Ruta de entrada"),
      outputTable: z.string().optional().describe("Tabla de salida"),
      batchSize: z.number().optional().describe("Batch size"),
      auditColumns: z.boolean().optional().default(true).describe("Incluir columnas de audit"),
      folderPath: z.string().optional().describe("Carpeta dentro de process/"),
    }),
    handler: async (input: { pattern: PatrónTalend; name: string; inputPath?: string; outputTable?: string; batchSize?: number; auditColumns?: boolean; folderPath?: string }) => {
      try {
        const projectPath = getConfiguredProjectPath();
        if (!projectPath) {
          return bridgeFail({
            ok: false,
            source: "workspace",
            confidence: "high",
            endpoint: "/job/apply-pipeline-spec",
            error: { code: "NO_PROJECT_PATH", message: "No se pudo determinar la ruta del proyecto Talend" },
          });
        }

        const logicalSpec = generateJobSpec(input.pattern, input.name, {
          inputPath: input.inputPath,
          outputTable: input.outputTable,
          batchSize: input.batchSize,
          auditColumns: input.auditColumns,
        });

        const genSpec = toGeneratorSpec(logicalSpec, { folderPath: input.folderPath });
        const genValidation = validateGeneratorSpec(genSpec);

        if (!genValidation.valid) {
          return bridgeFail({
            ok: false,
            source: "job-spec",
            confidence: "high",
            endpoint: "/job/apply-pipeline-spec",
            error: { code: "INVALID_GENERATOR_SPEC", message: genValidation.errors.join("; ") },
          });
        }

        const existingJob = await findExistingJob(projectPath, input.name);
        let snapshotCreated = false;
        let snapshotPath: string | undefined;

        if (existingJob) {
          const { readTextFile } = await import("../files");
          try {
            const content = await readTextFile(existingJob.itemPath, projectPath);
            snapshotPath = existingJob.itemPath + ".snapshot_" + Date.now();
            await writeTextFile(snapshotPath, content, projectPath);
            snapshotCreated = true;
          } catch {
          }
        }

        const version = "0.1";
        const itemFileName = `${input.name}_${version}.item`;
        const folderParts = (input.folderPath ?? "Process").replace(/\\/g, "/").split("/").filter(Boolean);
        const jobDir = folderParts.length > 0
          ? join(projectPath, "process", ...folderParts)
          : join(projectPath, "process");

        const { mkdirSync } = await import("node:fs");
        mkdirSync(jobDir, { recursive: true });

        const itemPath = join(jobDir, itemFileName);
        const propertiesFileName = `${input.name}_${version}.properties`;
        const propertiesPath = join(jobDir, propertiesFileName);

        const { xml: itemXml, rootId } = buildJobItemXml(genSpec);
        const propertiesXml = buildJobPropertiesXml(genSpec, rootId);

        await writeTextFile(itemPath, itemXml, projectPath);
        await writeTextFile(propertiesPath, propertiesXml, projectPath);

        let bridgeRefreshed = false;
        let bridgeOpened = false;
        let problemsData: unknown = null;

        try {
          const ctx = createPlatformContext();
          const bridge = await loadBridge();
          await bridge.refreshWorkspace();

          const studioPath = toTalendHostPath(itemPath, ctx);
          const openResult = await bridge.openResource(studioPath);
          bridgeOpened = openResult.ok;

          const problemsResult = await bridge.problemsMarkers();
          if (problemsResult.ok && problemsResult.data) {
            problemsData = problemsResult.data;
          }
          bridgeRefreshed = true;
        } catch {
        }

        return bridgeOk({
          ok: true,
          source: "job-spec",
          confidence: "high",
          endpoint: "/job/apply-pipeline-spec",
          data: {
            jobName: input.name,
            version,
            itemPath,
            propertiesPath,
            folderPath: input.folderPath ?? "Process",
            snapshotCreated,
            snapshotPath,
            generatedComponents: genSpec.components.length,
            connections: genSpec.connections?.length ?? 0,
            bridgeRefreshed,
            bridgeOpened,
            problems: problemsData,
          },
        });
      } catch (err) {
        return bridgeFail({
          ok: false,
          source: "job-spec",
          confidence: "low",
          endpoint: "/job/apply-pipeline-spec",
          error: { code: "APPLY_FAILED", message: String(err) },
        });
      }
    },
  },
  {
    name: "talend_job_apply_custom_spec",
    description: "Genera y escribe un job en el proyecto Talend a partir de una especificación custom (componentes, conexiones y variables de contexto).",
    inputSchema: z.object({
      jobName: z.string().describe("Nombre del job"),
      version: z.string().optional().default("0.1").describe("Versión del job"),
      defaultContext: z.string().optional().default("Default").describe("Contexto por defecto"),
      folderPath: z.string().optional().default("Process").describe("Carpeta de destino dentro de process/"),
      description: z.string().optional().describe("Descripción del job"),
      purpose: z.string().optional().describe("Propósito del job"),
      components: z.array(z.object({
        uniqueName: z.string().describe("Nombre único del componente (e.g. tMap_1)"),
        componentName: z.string().describe("Nombre del tipo de componente (e.g. tMap)"),
        posX: z.number().optional().describe("Posición X"),
        posY: z.number().optional().describe("Posición Y"),
        label: z.string().optional().describe("Etiqueta del componente"),
        parameters: z.record(z.string(), z.string()).optional().describe("Parámetros del componente"),
        schema: z.object({
          name: z.string().describe("Nombre del esquema"),
          connector: z.string().optional().default("FLOW").describe("Conector de esquema"),
          columns: z.array(z.object({
            name: z.string().describe("Nombre de la columna"),
            type: z.string().optional().default("id_String").describe("Tipo Talend de la columna"),
            length: z.number().optional().describe("Longitud"),
            precision: z.number().optional().describe("Precisión"),
            nullable: z.boolean().optional().default(true).describe("Es nulable"),
            key: z.boolean().optional().default(false).describe("Es clave"),
            sourceType: z.string().optional().describe("Tipo origen"),
            pattern: z.string().optional().describe("Patrón (e.g. fechas)"),
          })).describe("Columnas de esquema"),
        }).optional().describe("Esquema del componente"),
      })).describe("Componentes del job"),
      connections: z.array(z.object({
        source: z.string().describe("Componente origen"),
        target: z.string().describe("Componente destino"),
        label: z.string().describe("Etiqueta de la conexión (e.g. row1)"),
        connectorName: z.string().optional().default("FLOW").describe("Nombre del conector"),
        metaname: z.string().optional().describe("Meta name"),
        uniqueName: z.string().optional().describe("Nombre único"),
      })).optional().describe("Conexiones entre componentes"),
      contexts: z.array(z.object({
        name: z.string().describe("Nombre del parámetro de contexto"),
        type: z.string().describe("Tipo Talend del parámetro (e.g. id_String)"),
        value: z.string().describe("Valor por defecto"),
        comment: z.string().optional().describe("Comentario del parámetro"),
      })).optional().describe("Variables de contexto"),
    }),
    handler: async (input: {
      jobName: string;
      version?: string;
      defaultContext?: string;
      folderPath?: string;
      description?: string;
      purpose?: string;
      components: any[];
      connections?: any[];
      contexts?: any[];
    }) => {
      try {
        const projectPath = getConfiguredProjectPath();
        if (!projectPath) {
          return bridgeFail({
            ok: false,
            source: "workspace",
            confidence: "high",
            endpoint: "/job/apply-custom-spec",
            error: { code: "NO_PROJECT_PATH", message: "No se pudo determinar la ruta del proyecto Talend" },
          });
        }

        const genSpec = {
          jobName: input.jobName,
          version: input.version ?? "0.1",
          defaultContext: input.defaultContext ?? "Default",
          label: input.jobName,
          description: input.description,
          purpose: input.purpose,
          folderPath: input.folderPath ?? "Process",
          components: input.components,
          connections: input.connections,
          contexts: input.contexts,
        };

        const genValidation = validateGeneratorSpec(genSpec);
        if (!genValidation.valid) {
          return bridgeFail({
            ok: false,
            source: "job-spec",
            confidence: "high",
            endpoint: "/job/apply-custom-spec",
            error: { code: "INVALID_GENERATOR_SPEC", message: genValidation.errors.join("; ") },
          });
        }

        const existingJob = await findExistingJob(projectPath, input.jobName);
        let snapshotCreated = false;
        let snapshotPath: string | undefined;

        if (existingJob) {
          try {
            const content = await readTextFile(existingJob.itemPath, projectPath);
            snapshotPath = existingJob.itemPath + ".snapshot_" + Date.now();
            await writeTextFile(snapshotPath, content, projectPath);
            snapshotCreated = true;
          } catch {}
        }

        const version = input.version ?? "0.1";
        const itemFileName = `${input.jobName}_${version}.item`;
        const folderParts = (input.folderPath ?? "Process").replace(/\\/g, "/").split("/").filter(Boolean);
        const jobDir = folderParts.length > 0
          ? join(projectPath, "process", ...folderParts)
          : join(projectPath, "process");

        const { mkdirSync } = await import("node:fs");
        mkdirSync(jobDir, { recursive: true });

        const itemPath = join(jobDir, itemFileName);
        const propertiesFileName = `${input.jobName}_${version}.properties`;
        const propertiesPath = join(jobDir, propertiesFileName);

        const { xml: itemXml, rootId } = buildJobItemXml(genSpec);
        const propertiesXml = buildJobPropertiesXml(genSpec, rootId);

        await writeTextFile(itemPath, itemXml, projectPath);
        await writeTextFile(propertiesPath, propertiesXml, projectPath);

        let bridgeRefreshed = false;
        let bridgeOpened = false;
        let problemsData: unknown = null;

        try {
          const ctx = createPlatformContext();
          const bridge = await loadBridge();
          await bridge.refreshWorkspace();

          const studioPath = toTalendHostPath(itemPath, ctx);
          const openResult = await bridge.openResource(studioPath);
          bridgeOpened = openResult.ok;

          const problemsResult = await bridge.problemsMarkers();
          if (problemsResult.ok && problemsResult.data) {
            problemsData = problemsResult.data;
          }
          bridgeRefreshed = true;
        } catch {}

        return bridgeOk({
          ok: true,
          source: "job-spec",
          confidence: "high",
          endpoint: "/job/apply-custom-spec",
          data: {
            jobName: input.jobName,
            version,
            itemPath,
            propertiesPath,
            folderPath: input.folderPath ?? "Process",
            snapshotCreated,
            snapshotPath,
            generatedComponents: genSpec.components.length,
            connections: genSpec.connections?.length ?? 0,
            bridgeRefreshed,
            bridgeOpened,
            problems: problemsData,
          },
        });
      } catch (err) {
        return bridgeFail({
          ok: false,
          source: "job-spec",
          confidence: "low",
          endpoint: "/job/apply-custom-spec",
          error: { code: "APPLY_FAILED", message: String(err) },
        });
      }
    },
  },
];
