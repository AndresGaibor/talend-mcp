import * as z from "zod/v4";
import { bridgeOk, bridgeFail } from "../tools-base";

// Catálogo instalado y consultas de componentes.
export const componentCatalogTools = [
  {
    name: "talend_components_scan_installed",
    description: "Escanea los componentes instalados en Talend Studio.",
    inputSchema: z.object({
      pluginsDir: z.string().optional().describe("Directorio de plugins de Talend"),
    }),
    handler: async ({ pluginsDir }: { pluginsDir?: string }) => {
      const { TalendPluginScanner } = await import("../../../modules/component-knowledge/infrastructure/talend-plugin-scanner");
      const { ComponentCacheRepository } = await import("../../../modules/component-knowledge/infrastructure/component-cache.repository");
      const { saveComponentCatalog } = await import("../../components/component-catalog-store");
      const { resolveTalendPluginsDir } = await import("../../components/talend-paths");

      const scanner = new TalendPluginScanner();
      const cacheRepo = new ComponentCacheRepository();

      const resolvedDir = pluginsDir ?? resolveTalendPluginsDir() ?? pluginsDir;
      if (!resolvedDir) {
        return bridgeFail({
          ok: false,
          source: "workspace-files",
          confidence: "low",
          endpoint: "/components/scan",
          error: { code: "NO_PLUGINS_DIR", message: "No se pudo resolver el directorio de plugins de Talend" },
        });
      }

      const components = await scanner.scanStudioPlugins(resolvedDir);
      const result = await cacheRepo.save(components, resolvedDir);
      const catalog = await saveComponentCatalog({ pluginsDir: resolvedDir });

      return bridgeOk({
        ok: result.ok && catalog.ok,
        source: "workspace-files",
        confidence: result.ok && catalog.ok ? "high" : "low",
        endpoint: "/components/scan",
        data: {
          ...result,
          scannedComponents: components.length,
          pluginsDir: resolvedDir,
          catalog,
        },
      });
    },
  },
  {
    name: "talend_components_catalog_status",
    description: "Obtiene el estado del catálogo de componentes.",
    inputSchema: z.object({}),
    handler: async () => {
      const { getCatalogStatus } = await import("../../components/component-catalog-store");
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
      const { searchCatalog } = await import("../../components/component-catalog-store");
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
      const { inspectCatalogComponent } = await import("../../components/component-catalog-store");
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
];
