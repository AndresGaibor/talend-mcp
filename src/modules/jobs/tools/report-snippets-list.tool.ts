import { z } from "zod/v4";
import type { CallToolResult } from "@modelcontextprotocol/server";

export function createReportSnippetsListTool() {
  return {
    name: "talend_report_snippets_list",
    description: "Lista las secciones y categorías de snippets disponibles.",
    inputSchema: z.object({}),
    annotations: {
      readOnly: true,
    },
    handler: async (): Promise<CallToolResult> => {
      const categories = [
        { id: "diseno", label: "Diseño del Job", description: "Descripción de la arquitectura y componentes" },
        { id: "contextos", label: "Contextos Usados", description: "Parámetros de configuración por entorno" },
        { id: "validaciones", label: "Validaciones Realizadas", description: "Pruebas y verificaciones realizadas" },
        { id: "errores", label: "Errores y Soluciones", description: "Problemas encontrados y soluciones aplicadas" },
        { id: "tiempo", label: "Tiempo de Ejecución", description: "Métricas de rendimiento y optimización" },
        { id: "evidencias", label: "Evidencias Generadas", description: "Archivos y logs generados" },
      ];
      return {
        content: [{ type: "text", text: JSON.stringify(categories, null, 2) }],
        structuredContent: categories as any,
        isError: false,
      };
    },
  };
}
