import * as z from "zod/v4";
import { bridgeOk, bridgeFail } from "./tools-base";
import { generateJobSpec, validateJobSpec } from "../jobs/pipeline-patterns";
import type { PatrónTalend } from "../task/task-types";

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
];
