import * as z from "zod/v4";
import { join } from "node:path";
import { bridgeOk, bridgeFail, loadBridge } from "./tools-base";
import { generateJobSpec, validateJobSpec } from "../jobs/pipeline-patterns";
import { toGeneratorSpec, validateGeneratorSpec } from "../jobs/job-spec-generator";
import { buildJobItemXml, buildJobPropertiesXml } from "../job-generator";
import { writeTextFile } from "../files";
import { getConfiguredProjectPath } from "../workspace";
import { listJobs } from "../repository";
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
          const bridge = await loadBridge();
          await bridge.refreshWorkspace();

          const openResult = await bridge.openResource(itemPath);
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
];
