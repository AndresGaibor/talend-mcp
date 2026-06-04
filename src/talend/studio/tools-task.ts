import * as z from "zod/v4";
import { bridgeOk, bridgeFail } from "./tools-base";
import { analyzeTaskRequirements } from "../task/task-analyzer";

export const taskTools = [
  {
    name: "talend_task_analyze_requirements",
    description: "Analiza un enunciado de taller y detecta qué responsabilidades son de Talend vs externas, qué patrones se aplican y qué tools usar.",
    inputSchema: z.object({
      enunciado: z.string().describe("Enunciado del taller o requerimiento texto"),
      contextoAdicional: z.string().optional().describe("Contexto extra opcional"),
    }),
    handler: async ({ enunciado, contextoAdicional }: { enunciado: string; contextoAdicional?: string }) => {
      try {
        const result = analyzeTaskRequirements({ enunciado, contextoAdicional });
        return bridgeOk({
          ok: result.ok,
          source: "task-analyzer",
          confidence: result.confidence,
          endpoint: "/task/analyze-requirements",
          data: result,
        });
      } catch (err) {
        return bridgeFail({
          ok: false,
          source: "task-analyzer",
          confidence: "low",
          endpoint: "/task/analyze-requirements",
          error: { code: "ANALYSIS_FAILED", message: String(err) },
        });
      }
    },
  },
  {
    name: "talend_task_extract_talend_responsibilities",
    description: "Extrae solo las responsabilidades específicas de Talend del análisis de un requerimiento.",
    inputSchema: z.object({
      enunciado: z.string().describe("Enunciado del taller"),
    }),
    handler: async ({ enunciado }: { enunciado: string }) => {
      try {
        const result = analyzeTaskRequirements({ enunciado });
        return bridgeOk({
          ok: true,
          source: "task-analyzer",
          confidence: result.confidence,
          endpoint: "/task/extract-responsibilities",
          data: {
            talendResponsibilities: result.talendResponsibilities,
            patronesDetectados: result.patronesDetectados,
          },
        });
      } catch (err) {
        return bridgeFail({
          ok: false,
          source: "task-analyzer",
          confidence: "low",
          endpoint: "/task/extract-responsibilities",
          error: { code: "EXTRACTION_FAILED", message: String(err) },
        });
      }
    },
  },
  {
    name: "talend_task_build_execution_plan",
    description: "Dado un enunciado, construye un plan de ejecución con pasos numerados usando las tools disponibles.",
    inputSchema: z.object({
      enunciado: z.string().describe("Enunciado del taller"),
    }),
    handler: async ({ enunciado }: { enunciado: string }) => {
      try {
        const result = analyzeTaskRequirements({ enunciado });

        const plan: Array<{ step: number; action: string; tool: string | null; reason: string }> = [];
        let step = 1;

        if (result.suggestedTools.includes("talend_dataset_inspect_csv_folder")) {
          plan.push({
            step: step++,
            action: "Inspeccionar carpeta de CSVs",
            tool: "talend_dataset_inspect_csv_folder",
            reason: "Necesitamos conocer la estructura de los archivos CSV de entrada",
          });
        }

        if (result.suggestedTools.includes("talend_job_generate_from_pipeline_spec")) {
          plan.push({
            step: step++,
            action: "Generar especificación del job desde el patrón detectado",
            tool: "talend_job_generate_from_pipeline_spec",
            reason: `Patrón detectado: ${result.patronesDetectados.join(", ")}`,
          });
        }

        if (result.suggestedTools.includes("talend_job_validate_design")) {
          plan.push({
            step: step++,
            action: "Validar diseño del job",
            tool: "talend_job_validate_design",
            reason: "Verificar que el job cumple los requisitos del taller",
          });
        }

        if (result.suggestedTools.includes("talend_context_profile_apply_to_job")) {
          plan.push({
            step: step++,
            action: "Aplicar perfiles de contexto al job",
            tool: "talend_context_profile_apply_to_job",
            reason: "Configurar variables como input_path, batch_size, run_id",
          });
        }

        if (result.suggestedTools.includes("talend_job_run_by_name")) {
          plan.push({
            step: step++,
            action: "Ejecutar el job",
            tool: "talend_job_run_by_name",
            reason: "Ejecutar y medir tiempo del job",
          });
        }

        if (result.suggestedTools.includes("talend_deliverable_export_job")) {
          plan.push({
            step: step++,
            action: "Exportar entregable",
            tool: "talend_deliverable_export_job",
            reason: "Empaquetar el job para entrega",
          });
        }

        return bridgeOk({
          ok: true,
          source: "task-analyzer",
          confidence: result.confidence,
          endpoint: "/task/build-execution-plan",
          data: {
            plan,
            detectedPatterns: result.patronesDetectados,
            confidence: result.confidence,
          },
        });
      } catch (err) {
        return bridgeFail({
          ok: false,
          source: "task-analyzer",
          confidence: "low",
          endpoint: "/task/build-execution-plan",
          error: { code: "PLAN_BUILD_FAILED", message: String(err) },
        });
      }
    },
  },
];
