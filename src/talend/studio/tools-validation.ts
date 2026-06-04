import * as z from "zod/v4";
import { bridgeOk, bridgeFail } from "./tools-base";
import { validateJobDesign, DEFAULT_VALIDATION_CONTEXT } from "../validation/job-design-validator";
import type { JobSpec } from "../jobs/job-spec-types";
import type { ValidationContext } from "../validation/job-design-validator";

export const validationTools = [
  {
    name: "talend_job_validate_design",
    description: "Valida el diseño de un job contra reglas configurables.",
    inputSchema: z.object({
      spec: z.record(z.string(), z.unknown()).describe("Especificación del job"),
      context: z.record(z.string(), z.unknown()).optional().describe("Contexto de validación"),
    }),
    handler: async (input: { spec: Record<string, unknown>; context?: Record<string, unknown> }) => {
      try {
        const spec = input.spec as unknown as JobSpec;
        const validationContext = (input.context ?? DEFAULT_VALIDATION_CONTEXT) as unknown as ValidationContext;
        const result = validateJobDesign(spec, validationContext);
        return bridgeOk({
          ok: result.valid,
          source: "job-design-validator",
          confidence: result.valid ? "high" : "medium",
          endpoint: "/job/validate-design",
          data: result,
        });
      } catch (err) {
        return bridgeFail({
          ok: false,
          source: "job-design-validator",
          confidence: "low",
          endpoint: "/job/validate-design",
          error: { code: "VALIDATION_FAILED", message: String(err) },
        });
      }
    },
  },
  {
    name: "talend_job_validate_context_usage",
    description: "Valida que el job use los contextos requeridos.",
    inputSchema: z.object({
      spec: z.record(z.string(), z.unknown()).describe("Especificación del job"),
      requiredContexts: z.array(z.string()).optional().describe("Contextos requeridos"),
    }),
    handler: async (input: { spec: Record<string, unknown>; requiredContexts?: string[] }) => {
      try {
        const spec = input.spec as unknown as JobSpec;
        const contextNames = spec.contexts?.map((c) => c.name) ?? [];
        const required = input.requiredContexts ?? ["input_path", "batch_size", "run_id"];
        const missing = required.filter((r) => !contextNames.includes(r));

        return bridgeOk({
          ok: true,
          source: "job-design-validator",
          confidence: "high",
          endpoint: "/job/validate-context-usage",
          data: {
            contextNames,
            required,
            missing,
            hasAllRequired: missing.length === 0,
          },
        });
      } catch (err) {
        return bridgeFail({
          ok: false,
          source: "job-design-validator",
          confidence: "low",
          endpoint: "/job/validate-context-usage",
          error: { code: "VALIDATION_FAILED", message: String(err) },
        });
      }
    },
  },
  {
    name: "talend_job_validate_audit_columns",
    description: "Valida que el job tenga columnas de audit configuradas correctamente.",
    inputSchema: z.object({
      spec: z.record(z.string(), z.unknown()).describe("Especificación del job"),
    }),
    handler: async (input: { spec: Record<string, unknown> }) => {
      try {
        const spec = input.spec as unknown as JobSpec;
        const hasAuditColumns = spec.auditColumns === true;
        const technicalColumns = spec.technicalColumns ?? [];
        const hasLoadTs = technicalColumns.some((c) => c.name === "_load_ts");
        const hasLoadRun = technicalColumns.some((c) => c.name === "_load_run");

        return bridgeOk({
          ok: hasAuditColumns && hasLoadTs && hasLoadRun,
          source: "job-design-validator",
          confidence: "high",
          endpoint: "/job/validate-audit-columns",
          data: {
            auditColumnsEnabled: hasAuditColumns,
            has_load_ts: hasLoadTs,
            has_load_run: hasLoadRun,
            technicalColumns,
          },
        });
      } catch (err) {
        return bridgeFail({
          ok: false,
          source: "job-design-validator",
          confidence: "low",
          endpoint: "/job/validate-audit-columns",
          error: { code: "VALIDATION_FAILED", message: String(err) },
        });
      }
    },
  },
  {
    name: "talend_job_validate_performance_settings",
    description: "Valida configuración de performance del job (batch size, commits, etc).",
    inputSchema: z.object({
      spec: z.record(z.string(), z.unknown()).describe("Especificación del job"),
      maxBatchSize: z.number().optional().default(20000).describe("Batch size máximo esperado"),
    }),
    handler: async (input: { spec: Record<string, unknown>; maxBatchSize?: number }) => {
      try {
        const spec = input.spec as unknown as JobSpec;
        const batchSize = spec.batchSize ?? 5000;
        const max = input.maxBatchSize ?? 20000;

        const issues: string[] = [];
        if (batchSize < 100) {
          issues.push("batchSize muy pequeño, considerar >= 100 para efficiency");
        }
        if (batchSize > max) {
          issues.push(`batchSize ${batchSize} excede máximo ${max}`);
        }
        if (batchSize > 10000) {
          issues.push("batchSize > 10000 puede causar memory issues");
        }

        return bridgeOk({
          ok: issues.length === 0,
          source: "job-design-validator",
          confidence: "high",
          endpoint: "/job/validate-performance-settings",
          data: {
            batchSize,
            maxBatchSize: max,
            issues,
            recommendation: batchSize >= 1000 && batchSize <= 10000
              ? "batchSize en rango óptimo"
              : "revisar batchSize",
          },
        });
      } catch (err) {
        return bridgeFail({
          ok: false,
          source: "job-design-validator",
          confidence: "low",
          endpoint: "/job/validate-performance-settings",
          error: { code: "VALIDATION_FAILED", message: String(err) },
        });
      }
    },
  },
];
