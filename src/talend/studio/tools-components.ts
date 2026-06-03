import * as z from "zod/v4";
import { existsSync } from "node:fs";
import { bridgeOk, bridgeFail } from "./tools-base";
import { getConfiguredProjectPath } from "../workspace";

export const componentTools = [
  {
    name: "talend_components_scan_installed",
    description: "Escanea los componentes instalados en Talend Studio.",
    inputSchema: z.object({
      pluginsDir: z.string().optional().describe("Directorio de plugins de Talend"),
    }),
    handler: async ({ pluginsDir }: { pluginsDir?: string }) => {
      const { saveComponentCatalog } = await import("../components/component-catalog-store");
      const result = await saveComponentCatalog({ pluginsDir });
      return bridgeOk({
        ok: result.ok,
        source: "workspace-files",
        confidence: result.ok ? "high" : "low",
        endpoint: "/components/scan",
        data: result,
      });
    },
  },
  {
    name: "talend_components_catalog_status",
    description: "Obtiene el estado del catálogo de componentes.",
    inputSchema: z.object({}),
    handler: async () => {
      const { getCatalogStatus } = await import("../components/component-catalog-store");
      const result = await getCatalogStatus();
      return bridgeOk({
        ok: result.ok,
        source: "workspace-files",
        confidence: result.ok ? "high" : "low",
        endpoint: "/components/catalog-status",
        data: result,
      });
    },
  },
  {
    name: "talend_components_search",
    description: "Busca componentes en el catálogo.",
    inputSchema: z.object({
      query: z.string().describe("Texto a buscar"),
      maxResults: z.number().optional().default(20).describe("Máximo de resultados"),
    }),
    handler: async ({ query, maxResults }: { query: string; maxResults?: number }) => {
      const { searchCatalog } = await import("../components/component-catalog-store");
      const results = await searchCatalog(query, maxResults);
      return bridgeOk({
        ok: true,
        source: "workspace-files",
        confidence: "high",
        endpoint: "/components/search",
        data: { results, count: results.length },
      });
    },
  },
  {
    name: "talend_components_inspect",
    description: "Inspecciona un componente específico.",
    inputSchema: z.object({
      componentName: z.string().describe("Nombre del componente"),
    }),
    handler: async ({ componentName }: { componentName: string }) => {
      const { inspectCatalogComponent } = await import("../components/component-catalog-store");
      const result = await inspectCatalogComponent(componentName);
      return bridgeOk({
        ok: result !== null,
        source: "workspace-files",
        confidence: result ? "high" : "low",
        endpoint: "/components/inspect",
        data: { component: result },
      });
    },
  },
  {
    name: "talend_components_parameters",
    description: "Lista los parámetros de un componente.",
    inputSchema: z.object({
      componentName: z.string().describe("Nombre del componente"),
    }),
    handler: async ({ componentName }: { componentName: string }) => {
      const { inspectCatalogComponent } = await import("../components/component-catalog-store");
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
      const { inspectCatalogComponent } = await import("../components/component-catalog-store");
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
      const { masteryGenerateFixture } = await import("../mastery/component-mastery-runner");
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
      const effectivePath = projectPath ?? getConfiguredProjectPath();
      if (!effectivePath) {
        return bridgeFail({
          ok: false,
          source: "unavailable",
          confidence: "low",
          endpoint: "/components/validate-usage",
          error: { code: "NO_PROJECT", message: "No se detectó TALEND_PROJECT" },
        });
      }
      const { searchCatalog } = await import("../components/component-catalog-store");
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