import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { scanInstalledPlugins, entriesToCatalogFormat, type ComponentJarEntry } from "./component-jar-scanner";

export type ComponentCatalogMetadata = {
  generatedAt: number;
  talendStudioHome: string;
  entries: ComponentJarEntry[];
  errors: string[];
  scannedPlugins: string[];
};

export type CatalogStatus = {
  ok: boolean;
  catalogPath: string | null;
  entryCount: number;
  lastUpdated: number | null;
  scannedPlugins: string[];
  errors: string[];
};

const CATALOG_DIR = ".talend-mcp";
const CATALOG_FILE = "component-catalog.json";

function ensureCatalogDir(): string {
  const dir = join(process.cwd(), CATALOG_DIR);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export async function saveComponentCatalog(options?: {
  pluginsDir?: string;
  talendStudioHome?: string;
}): Promise<CatalogStatus> {
  const errors: string[] = [];
  const scannedPlugins: string[] = [];

  const pluginsDir = options?.pluginsDir ?? process.env.TALEND_STUDIO_PATH ?? "/Applications/TalendStudio-8.0.1/studio";
  const talendStudioHome = options?.talendStudioHome ?? pluginsDir;

  const scanResult = await scanInstalledPlugins({ pluginsDir });

  const metadata = entriesToCatalogFormat(
    scanResult.entries,
    scanResult.scannedPlugins,
    scanResult.errors,
    talendStudioHome,
  );

  const catalogDir = ensureCatalogDir();
  const catalogPath = join(catalogDir, CATALOG_FILE);

  try {
    writeFileSync(catalogPath, JSON.stringify(metadata, null, 2), "utf8");
  } catch (e) {
    errors.push("Failed to write catalog: " + (e instanceof Error ? e.message : String(e)));
  }

  return {
    ok: errors.length === 0,
    catalogPath,
    entryCount: scanResult.entries.length,
    lastUpdated: metadata.generatedAt,
    scannedPlugins: scanResult.scannedPlugins,
    errors: [...scanResult.errors, ...errors],
  };
}

export async function getCatalogStatus(): Promise<CatalogStatus> {
  const catalogPath = join(process.cwd(), CATALOG_DIR, CATALOG_FILE);

  if (!existsSync(catalogPath)) {
    return {
      ok: false,
      catalogPath: null,
      entryCount: 0,
      lastUpdated: null,
      scannedPlugins: [],
      errors: ["Catalog not found. Run talend_components_scan_installed first."],
    };
  }

  try {
    const content = readFileSync(catalogPath, "utf8");
    const data = JSON.parse(content) as ComponentCatalogMetadata;
    return {
      ok: true,
      catalogPath,
      entryCount: data.entries?.length ?? 0,
      lastUpdated: data.generatedAt ?? null,
      scannedPlugins: data.scannedPlugins ?? [],
      errors: data.errors ?? [],
    };
  } catch (e) {
    return {
      ok: false,
      catalogPath: null,
      entryCount: 0,
      lastUpdated: null,
      scannedPlugins: [],
      errors: ["Failed to read catalog: " + (e instanceof Error ? e.message : String(e))],
    };
  }
}

export async function loadComponentCatalog(): Promise<ComponentCatalogMetadata | null> {
  const catalogPath = join(process.cwd(), CATALOG_DIR, CATALOG_FILE);

  if (!existsSync(catalogPath)) {
    return null;
  }

  try {
    const content = readFileSync(catalogPath, "utf8");
    return JSON.parse(content) as ComponentCatalogMetadata;
  } catch {
    return null;
  }
}

export async function searchCatalog(
  query: string,
  maxResults = 20,
): Promise<ComponentJarEntry[]> {
  const catalog = await loadComponentCatalog();
  if (!catalog) return [];

  const lowerQuery = query.toLowerCase();
  return catalog.entries
    .filter(
      (e) =>
        e.componentName.toLowerCase().includes(lowerQuery) ||
        e.family.toLowerCase().includes(lowerQuery) ||
        e.connectors.some((c) => c.name.toLowerCase().includes(lowerQuery)),
    )
    .slice(0, maxResults);
}

export async function inspectCatalogComponent(
  componentName: string,
): Promise<ComponentJarEntry | null> {
  const catalog = await loadComponentCatalog();
  if (!catalog) return null;
  return catalog.entries.find((e) => e.componentName === componentName) ?? null;
}
