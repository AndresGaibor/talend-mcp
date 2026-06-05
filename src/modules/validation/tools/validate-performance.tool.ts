import { z } from "zod/v4";
import type { CallToolResult } from "@modelcontextprotocol/server";

export function createValidatePerformanceTool() {
  return {
    name: "talend_validation_validate_performance",
    description: "Valida configuración de performance del job (batch size, commits, etc).",
    inputSchema: z.object({
      spec: z.record(z.string(), z.unknown()).describe("Especificación del job"),
      maxBatchSize: z.number().optional().default(20000).describe("Batch size máximo esperado"),
    }),
    annotations: {
      readOnly: true,
    },
    handler: async (input: { spec: Record<string, unknown>; maxBatchSize?: number }): Promise<CallToolResult> => {
      try {
        const spec = input.spec as any;
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

        const result = {
          batchSize,
          maxBatchSize: max,
          issues,
          recommendation: batchSize >= 1000 && batchSize <= 10000
            ? "batchSize en rango óptimo"
            : "revisar batchSize",
        };

        return {
          content: [{ type: "text", text: `Validación de rendimiento completada. Issues: ${issues.length}` }],
          structuredContent: result as any,
          isError: false,
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error validando rendimiento: ${err}` }],
          isError: true,
        };
      }
    },
  };
}
