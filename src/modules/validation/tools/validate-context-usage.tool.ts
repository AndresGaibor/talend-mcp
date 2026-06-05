import { z } from "zod/v4";
import type { CallToolResult } from "@modelcontextprotocol/server";

export function createValidateContextUsageTool() {
  return {
    name: "talend_validation_validate_context_usage",
    description: "Valida que el job use los contextos requeridos.",
    inputSchema: z.object({
      spec: z.record(z.string(), z.unknown()).describe("Especificación del job"),
      requiredContexts: z.array(z.string()).optional().describe("Contextos requeridos"),
    }),
    annotations: {
      readOnly: true,
    },
    handler: async (input: { spec: Record<string, unknown>; requiredContexts?: string[] }): Promise<CallToolResult> => {
      try {
        const spec = input.spec as any;
        const contextNames = spec.contexts?.map((c: any) => c.name) ?? [];
        const required = input.requiredContexts ?? ["input_path", "batch_size", "run_id"];
        const missing = required.filter((r) => !contextNames.includes(r));

        const result = {
          contextNames,
          required,
          missing,
          hasAllRequired: missing.length === 0,
        };

        return {
          content: [{ type: "text", text: `Faltan contexts requeridos: ${missing.join(", ") || "Ninguno"}` }],
          structuredContent: result as any,
          isError: false,
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error validando contextos: ${err}` }],
          isError: true,
        };
      }
    },
  };
}
