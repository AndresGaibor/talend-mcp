import { z } from "zod/v4";
import type { CallToolResult } from "@modelcontextprotocol/server";

export function createValidateDesignTool() {
  return {
    name: "talend_validation_validate_design",
    description: "Valida el diseño de un job contra reglas configurables.",
    inputSchema: z.object({
      spec: z.record(z.string(), z.unknown()).describe("Especificación del job"),
      context: z.record(z.string(), z.unknown()).optional().describe("Contexto de validación"),
    }),
    annotations: {
      readOnly: true,
    },
    handler: async (input: { spec: Record<string, unknown>; context?: Record<string, unknown> }): Promise<CallToolResult> => {
      try {
        const { validateJobDesign, DEFAULT_VALIDATION_CONTEXT } = await import("../../../talend/validation/job-design-validator");
        const spec = input.spec as any;
        const validationContext = input.context ?? DEFAULT_VALIDATION_CONTEXT;
        const result = validateJobDesign(spec, validationContext as any);
        return {
          content: [{ type: "text", text: `Validación completada. Válido: ${result.valid}` }],
          structuredContent: result as any,
          isError: false,
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error validando diseño: ${err}` }],
          isError: true,
        };
      }
    },
  };
}
