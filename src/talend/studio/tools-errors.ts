import * as z from "zod/v4";
import { bridgeOk, bridgeFail } from "./tools-base";
import { getConfiguredProjectPath } from "../workspace";
import { existsSync } from "node:fs";

export const errorTools = [
  {
    name: "talend_error_explain",
    description: "Explica un error de Talend.",
    inputSchema: z.object({
      errorMessage: z.string().describe("Mensaje de error"),
    }),
    handler: async ({ errorMessage }: { errorMessage: string }) => {
      const { analyzeError } = await import("../diagnostics/error-knowledge-base");
      const explanation = analyzeError(errorMessage);
      return bridgeOk({
        ok: true,
        source: "workspace-files",
        confidence: explanation ? "high" : "low",
        endpoint: "/errors/explain",
        data: { explanation },
      });
    },
  },
  {
    name: "talend_error_stats",
    description: "Obtiene estadísticas de errores conocidos.",
    inputSchema: z.object({}),
    handler: async () => {
      const { getErrorStats } = await import("../diagnostics/error-knowledge-base");
      const stats = getErrorStats();
      return bridgeOk({
        ok: true,
        source: "workspace-files",
        confidence: "high",
        endpoint: "/errors/stats",
        data: stats,
      });
    },
  },
  {
    name: "talend_error_suggest_fix",
    description: "Sugiere un fix automático para un error.",
    inputSchema: z.object({
      errorMessage: z.string().describe("Mensaje de error detectado"),
    }),
    handler: async ({ errorMessage }: { errorMessage: string }) => {
      const { suggestFix } = await import("../diagnostics/error-knowledge-base");
      const result = suggestFix(errorMessage);
      return bridgeOk({
        ok: true,
        source: "workspace-files",
        confidence: result.error ? "high" : "low",
        endpoint: "/errors/suggest-fix",
        data: {
          error: result.error,
          advice: result.advice,
        },
      });
    },
  },
  {
    name: "talend_error_map_to_component",
    description: "Asocia un error a un componente del job.",
    inputSchema: z.object({
      errorMessage: z.string().describe("Mensaje de error"),
      itemPath: z.string().describe("Ruta al archivo .item"),
    }),
    handler: async ({ errorMessage, itemPath }: { errorMessage: string; itemPath: string }) => {
      const projectPath = getConfiguredProjectPath();
      if (!projectPath || !existsSync(itemPath)) {
        return bridgeOk({
          ok: true,
          source: "workspace-files",
          confidence: "low",
          endpoint: "/errors/map-to-component",
          data: { mappedComponent: null, reason: "Archivo no encontrado" },
        });
      }
      try {
        const { readTextFile } = await import("../files");
        const xml = await readTextFile(itemPath, projectPath);
        const { analyzeTdbOutputs } = await import("../analysis");
        const { parseJobItem } = await import("../job-parser");
        const parsed = parseJobItem(xml, itemPath);
        const components = analyzeTdbOutputs(parsed);
        let mappedComponent: string | null = null;
        const lowerError = errorMessage.toLowerCase();
        for (const comp of components) {
          const compName = comp.componentName.toLowerCase();
          if (lowerError.includes(compName) || lowerError.includes(comp.uniqueName.toLowerCase())) {
            mappedComponent = comp.uniqueName;
            break;
          }
        }
        return bridgeOk({
          ok: true,
          source: "workspace-files",
          confidence: mappedComponent ? "high" : "low",
          endpoint: "/errors/map-to-component",
          data: {
            mappedComponent,
            reason: mappedComponent ? "Componente encontrado en mensaje de error" : "No se pudo asociar",
          },
        });
      } catch {
        return bridgeOk({
          ok: true,
          source: "workspace-files",
          confidence: "low",
          endpoint: "/errors/map-to-component",
          data: { mappedComponent: null, reason: "Error al parsear el job" },
        });
      }
    },
  },
];