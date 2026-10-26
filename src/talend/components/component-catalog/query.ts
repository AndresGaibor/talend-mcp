import { existsSync, readFileSync } from "node:fs";
import { catalogFilePath } from "./paths";
import type { CatalogStatus, ComponentCatalogEntry } from "./types";

export async function getCatalogStatus(): Promise<CatalogStatus> {
  const catalogPath = catalogFilePath();

  if (!existsSync(catalogPath)) {
    return {
      ok: false,
      catalogPath: null,
      entryCount: 0,
      lastUpdated: null,
      scannedPlugins: [],
      errors: ["Catalog not found. Run buildComponentCatalog first."],
    };
  }

  try {
    const content = readFileSync(catalogPath, "utf8");
    const data = JSON.parse(content);
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

export async function searchComponents(query: string, maxResults = 20): Promise<ComponentCatalogEntry[]> {
  const catalogPath = catalogFilePath();

  if (!existsSync(catalogPath)) {
    return [];
  }

  try {
    const content = readFileSync(catalogPath, "utf8");
    const data = JSON.parse(content);
    const entries: ComponentCatalogEntry[] = data.entries ?? [];
    const lowerQuery = query.toLowerCase();

    return entries
      .filter(
        (e: ComponentCatalogEntry) =>
          e.componentName.toLowerCase().includes(lowerQuery) ||
          e.family.toLowerCase().includes(lowerQuery) ||
          e.connectors.some((c) => c.toLowerCase().includes(lowerQuery)),
      )
      .slice(0, maxResults);
  } catch {
    return [];
  }
}

export async function inspectComponent(componentName: string): Promise<ComponentCatalogEntry | null> {
  const catalogPath = catalogFilePath();

  if (!existsSync(catalogPath)) {
    return null;
  }

  try {
    const content = readFileSync(catalogPath, "utf8");
    const data = JSON.parse(content);
    const entries: ComponentCatalogEntry[] = data.entries ?? [];
    return entries.find((e: ComponentCatalogEntry) => e.componentName === componentName) ?? null;
  } catch {
    return null;
  }
}
