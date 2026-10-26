/**
 * Generacion del job a partir de una especificacion de pipeline, sin escribir archivos.
 */
import * as z from "zod/v4";
import { bridgeFail, bridgeOk } from "../tools-base";
import { generateJobSpec, validateJobSpec } from "../../jobs/pipeline-patterns";
import type { PatrónTalend } from "../../task/task-types";

export const jobSpecGenerationTools = [
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
