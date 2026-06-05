import * as z from "zod/v4";
import { bridgeOk, bridgeFail } from "./tools-base";
import { analyzeTaskRequirements } from "../task/task-analyzer";
import { defineTool, type ToolContext } from "../../server/tool-definition";
import { okResult, errorResult } from "../../presentation/tools/common/result";

const AnalyzeRequirementsInput = z.object({
  enunciado: z.string().describe("Enunciado del taller o requerimiento texto"),
  contextoAdicional: z.string().optional().describe("Contexto extra opcional"),
});
type AnalyzeRequirementsInput = z.infer<typeof AnalyzeRequirementsInput>;

const AnalyzeRequirementsOutput = z.object({
  ok: z.boolean(),
  talendResponsibilities: z.array(z.string()),
  patronesDetectados: z.array(z.string()),
  suggestedTools: z.array(z.string()),
  confidence: z.enum(["high", "medium", "low", "none"]),
  recommendations: z.array(z.string()),
});
type AnalyzeRequirementsOutput = z.infer<typeof AnalyzeRequirementsOutput>;

export const talend_task_analyze_requirements = defineTool({
  name: "talend_task_analyze_requirements",
  title: "Analizar Requerimientos",
  description: "Analiza un enunciado de taller y detecta qué responsabilidades son de Talend vs externas, qué patrones se aplican y qué tools usar.",
  category: "task",
  inputSchema: AnalyzeRequirementsInput,
  outputSchema: AnalyzeRequirementsOutput,
  safety: {
    readOnlyHint: true,
    idempotentHint: true,
    destructiveHint: false,
    openWorldHint: false,
    requiresConfirmation: false,
    risk: "low",
  },
  async handler(input: AnalyzeRequirementsInput, _ctx: ToolContext) {
    try {
      const result = analyzeTaskRequirements({ enunciado: input.enunciado, contextoAdicional: input.contextoAdicional });
      return okResult(
        {
          ok: result.ok,
          talendResponsibilities: result.talendResponsibilities,
          patronesDetectados: result.patronesDetectados,
          suggestedTools: result.suggestedTools,
          confidence: result.confidence,
          recommendations: result.recommendations,
        },
        "task-analyzer",
        result.confidence
      );
    } catch (err) {
      return errorResult("task-analyzer", "ANALYSIS_FAILED", String(err));
    }
  },
});

const ExtractResponsibilitiesInput = z.object({
  enunciado: z.string().describe("Enunciado del taller"),
});
type ExtractResponsibilitiesInput = z.infer<typeof ExtractResponsibilitiesInput>;

const ExtractResponsibilitiesOutput = z.object({
  talendResponsibilities: z.array(z.string()),
  patronesDetectados: z.array(z.string()),
});
type ExtractResponsibilitiesOutput = z.infer<typeof ExtractResponsibilitiesOutput>;

export const talend_task_extract_talend_responsibilities = defineTool({
  name: "talend_task_extract_talend_responsibilities",
  title: "Extraer Responsabilidades Talend",
  description: "Extrae solo las responsabilidades específicas de Talend del análisis de un requerimiento.",
  category: "task",
  inputSchema: ExtractResponsibilitiesInput,
  outputSchema: ExtractResponsibilitiesOutput,
  safety: {
    readOnlyHint: true,
    idempotentHint: true,
    destructiveHint: false,
    openWorldHint: false,
    requiresConfirmation: false,
    risk: "low",
  },
  async handler(input: ExtractResponsibilitiesInput, _ctx: ToolContext) {
    try {
      const result = analyzeTaskRequirements({ enunciado: input.enunciado });
      return okResult(
        {
          talendResponsibilities: result.talendResponsibilities,
          patronesDetectados: result.patronesDetectados,
        },
        "task-analyzer",
        result.confidence
      );
    } catch (err) {
      return errorResult("task-analyzer", "EXTRACTION_FAILED", String(err));
    }
  },
});

const BuildExecutionPlanInput = z.object({
  enunciado: z.string().describe("Enunciado del taller"),
});
type BuildExecutionPlanInput = z.infer<typeof BuildExecutionPlanInput>;

const BuildExecutionPlanOutput = z.object({
  plan: z.array(z.object({
    step: z.number(),
    action: z.string(),
    tool: z.string().nullable(),
    reason: z.string(),
  })),
  detectedPatterns: z.array(z.string()),
  confidence: z.enum(["high", "medium", "low", "none"]),
});
type BuildExecutionPlanOutput = z.infer<typeof BuildExecutionPlanOutput>;

export const talend_task_build_execution_plan = defineTool({
  name: "talend_task_build_execution_plan",
  title: "Construir Plan de Ejecución",
  description: "Dado un enunciado, construye un plan de ejecución con pasos numerados usando las tools disponibles.",
  category: "task",
  inputSchema: BuildExecutionPlanInput,
  outputSchema: BuildExecutionPlanOutput,
  safety: {
    readOnlyHint: true,
    idempotentHint: true,
    destructiveHint: false,
    openWorldHint: false,
    requiresConfirmation: false,
    risk: "low",
  },
  async handler(input: BuildExecutionPlanInput, _ctx: ToolContext) {
    try {
      const result = analyzeTaskRequirements({ enunciado: input.enunciado });

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

      return okResult(
        {
          plan,
          detectedPatterns: result.patronesDetectados,
          confidence: result.confidence,
        },
        "task-analyzer",
        result.confidence
      );
    } catch (err) {
      return errorResult("task-analyzer", "PLAN_BUILD_FAILED", String(err));
    }
  },
});

export const taskToolsNew = [
  talend_task_analyze_requirements,
  talend_task_extract_talend_responsibilities,
  talend_task_build_execution_plan,
];
