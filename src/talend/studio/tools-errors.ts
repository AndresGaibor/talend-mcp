import * as z from "zod/v4";
import { bridgeOk } from "./tools-base";
import { resolveProjectPath } from "../workspace";
import { existsSync } from "node:fs";

/**
 * Tools de errores.
 *
 * `talend_errors_explain`, `talend_errors_suggest_fix` y `talend_errors_stats`
 * viven en `src/modules/errors/tools/`. Aqui queda solo lo que no tiene
 * equivalente canonico.
 */
export const errorTools = [
  {
    name: "talend_error_map_to_component",
    description: "Asocia un error a un componente del job.",
    inputSchema: z.object({
      errorMessage: z.string().describe("Mensaje de error"),
      itemPath: z.string().describe("Ruta al archivo .item"),
    }),
    handler: async ({ errorMessage, itemPath }: { errorMessage: string; itemPath: string }) => {
      const projectPath = await resolveProjectPath();
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
