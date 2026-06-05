import { z } from "zod/v4";
import type { CallToolResult } from "@modelcontextprotocol/server";

export function createValidateAuditColumnsTool() {
  return {
    name: "talend_validation_validate_audit_columns",
    description: "Valida que el job tenga columnas de audit configuradas correctamente.",
    inputSchema: z.object({
      spec: z.record(z.string(), z.unknown()).describe("Especificación del job"),
    }),
    annotations: {
      readOnly: true,
    },
    handler: async (input: { spec: Record<string, unknown> }): Promise<CallToolResult> => {
      try {
        const spec = input.spec as any;
        const hasAuditColumns = spec.auditColumns === true;
        const technicalColumns = spec.technicalColumns ?? [];
        const hasLoadTs = technicalColumns.some((c: any) => c.name === "_load_ts");
        const hasLoadRun = technicalColumns.some((c: any) => c.name === "_load_run");

        const ok = hasAuditColumns && hasLoadTs && hasLoadRun;
        const result = {
          auditColumnsEnabled: hasAuditColumns,
          has_load_ts: hasLoadTs,
          has_load_run: hasLoadRun,
          technicalColumns,
        };

        return {
          content: [{ type: "text", text: `Validación de audit completada: ${ok ? "Correcto" : "Faltan columnas o configuración"}` }],
          structuredContent: result as any,
          isError: false,
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error validando columnas de audit: ${err}` }],
          isError: true,
        };
      }
    },
  };
}
