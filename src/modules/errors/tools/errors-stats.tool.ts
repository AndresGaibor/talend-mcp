import { z } from "zod/v4";
import type { CallToolResult } from "@modelcontextprotocol/server";

export function createErrorsStatsTool() {
  return {
    name: "talend_errors_stats",
    description: "Obtiene estadísticas de errores conocidos.",
    inputSchema: z.object({}),
    annotations: {
      readOnly: true,
    },
    handler: async (): Promise<CallToolResult> => {
      try {
        const { getErrorStats } = await import("../../../talend/diagnostics/error-knowledge-base");
        const stats = getErrorStats();
        return {
          content: [{ type: "text", text: `Estadísticas obtenidas: ${Object.keys(stats).length} categorías.` }],
          structuredContent: stats as any,
          isError: false,
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error obteniendo estadísticas: ${err}` }],
          isError: true,
        };
      }
    },
  };
}
