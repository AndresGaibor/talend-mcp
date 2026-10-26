import * as z from "zod/v4";
import { bridgeOk, bridgeFail } from "../tools-base";
import { resolveProjectPath } from "../../workspace";

// Parámetros, conectores y validación de uso de un componente.
export const componentParameterTools = [
  {
    name: "talend_components_parameters",
    description: "Lista los parámetros de un componente.",
    inputSchema: z.object({
      componentName: z.string().describe("Nombre del componente"),
    }),
    handler: async ({ componentName }: { componentName: string }) => {
      const { inspectCatalogComponent } = await import("../../components/component-catalog-store");
      const component = await inspectCatalogComponent(componentName);
      if (!component) {
        return bridgeFail({
          ok: false,
          source: "workspace-files",
          confidence: "low",
          endpoint: "/components/parameters",
          error: { code: "NOT_FOUND", message: "Componente no encontrado: " + componentName },
        });
      }
      return bridgeOk({
        ok: true,
        source: "catalog",
        confidence: "high",
        endpoint: "/components/parameters",
        data: { parameters: component.parameters },
      });
    },
  },
  {
    name: "talend_components_connectors",
    description: "Lista los conectores de un componente.",
    inputSchema: z.object({
      componentName: z.string().describe("Nombre del componente"),
    }),
    handler: async ({ componentName }: { componentName: string }) => {
      const { inspectCatalogComponent } = await import("../../components/component-catalog-store");
      const component = await inspectCatalogComponent(componentName);
      if (!component) {
        return bridgeFail({
          ok: false,
          source: "workspace-files",
          confidence: "low",
          endpoint: "/components/connectors",
          error: { code: "NOT_FOUND", message: "Componente no encontrado: " + componentName },
        });
      }
      return bridgeOk({
        ok: true,
        source: "catalog",
        confidence: "high",
        endpoint: "/components/connectors",
        data: { connectors: component.connectors },
      });
    },
  },
  {
    name: "talend_components_generate_template",
    description: "Genera una plantilla de job para un componente.",
    inputSchema: z.object({
      componentName: z.string().describe("Nombre del componente"),
    }),
    handler: async ({ componentName }: { componentName: string }) => {
      const { masteryGenerateFixture } = await import("../../mastery/component-mastery-runner");
      const result = await masteryGenerateFixture(componentName);
      return bridgeOk({
        ok: result.ok,
        source: result.ok ? "workspace-files" : "unavailable",
        confidence: result.ok ? "high" : "low",
        endpoint: "/components/generate-template",
        data: result,
      });
    },
  },
  {
    name: "talend_components_validate_usage",
    description: "Valida el uso de un componente en el proyecto.",
    inputSchema: z.object({
      componentName: z.string().describe("Nombre del componente"),
      projectPath: z.string().optional().describe("Ruta al proyecto"),
    }),
    handler: async ({ componentName, projectPath }: { componentName: string; projectPath?: string }) => {
      const effectivePath = projectPath ?? await resolveProjectPath();
      if (!effectivePath) {
        return bridgeFail({
          ok: false,
          source: "unavailable",
          confidence: "low",
          endpoint: "/components/validate-usage",
          error: { code: "NO_PROJECT", message: "No se detectó TALEND_PROJECT" },
        });
      }
      const { searchCatalog } = await import("../../components/component-catalog-store");
      const results = await searchCatalog(componentName, 1);
      const component = results[0];
      return bridgeOk({
        ok: component !== undefined,
        source: "workspace-files",
        confidence: component ? "high" : "low",
        endpoint: "/components/validate-usage",
        data: {
          found: component !== undefined,
          componentName,
          projectPath: effectivePath,
        },
      });
    },
  },
];
