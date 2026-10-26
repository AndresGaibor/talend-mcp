import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { scanInstalledPlugins, entriesToCatalogFormat, type ComponentJarEntry } from "../component-jar-scanner";
import { resolveTalendPluginsDir, resolveTalendStudioHome } from "../talend-paths";
import { CATALOG_FILE, catalogFilePath, ensureCatalogDir } from "./paths";
import type { CatalogStatus, ComponentCatalogEntry } from "./types";

function jarToCatalogEntry(jar: ComponentJarEntry): ComponentCatalogEntry {
  return {
    componentName: jar.componentName,
    family: jar.family,
    version: jar.version,
    pluginJar: jar.sourcePlugin,
    definitionFiles: jar.definitionFiles,
    parameters: jar.parameters.map((p) => ({
      name: p.name,
      field: p.field,
      required: p.required,
      defaultValue: p.defaultValue ?? "",
      show: p.show,
      repositoryValue: p.repositoryValue,
    })),
    schemas: jar.schemas,
    connectors: jar.connectors.map((c) => c.name),
    dependencies: [],
    limitations: jar.limitations,
  };
}

export async function buildComponentCatalog(talendStudioPath?: string): Promise<CatalogStatus> {
  const pluginsDir = resolveTalendPluginsDir({ talendStudioHome: talendStudioPath });

  const scanResult = await scanInstalledPlugins({ pluginsDir: pluginsDir ?? undefined });

  const catalog = scanResult.entries.map(jarToCatalogEntry);

  const talendStudioHome = resolveTalendStudioHome({ talendStudioHome: talendStudioPath }) ?? "Talend Studio (ruta no detectada)";
  const catalogData = entriesToCatalogFormat(
    scanResult.entries,
    scanResult.scannedPlugins,
    scanResult.errors,
    talendStudioHome,
  );

  const catalogDir = ensureCatalogDir();
  const catalogPath = join(catalogDir, CATALOG_FILE);
  const writeErrors: string[] = [];

  try {
    writeFileSync(catalogPath, JSON.stringify(catalogData, null, 2), "utf8");
  } catch (e) {
    writeErrors.push("Failed to write catalog: " + (e instanceof Error ? e.message : String(e)));
  }

  return {
    ok: writeErrors.length === 0,
    catalogPath,
    entryCount: catalog.length,
    lastUpdated: catalogData.generatedAt,
    scannedPlugins: scanResult.scannedPlugins,
    errors: [...scanResult.errors, ...writeErrors],
  };
}
