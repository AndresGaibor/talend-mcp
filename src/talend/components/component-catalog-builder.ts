import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { scanInstalledPlugins, entriesToCatalogFormat, type ComponentJarEntry } from "./component-jar-scanner";

export type ComponentCatalogEntry = {
  componentName: string;
  family: string;
  version: string;
  pluginJar: string;
  definitionFiles: string[];
  parameters: ComponentParameter[];
  schemas: {
    hasInputSchema: boolean;
    hasOutputSchema: boolean;
    hasDynamicSchema: boolean;
  };
  connectors: string[];
  dependencies: string[];
  limitations: string[];
};

export type ComponentParameter = {
  name: string;
  field: string;
  required: boolean;
  defaultValue: string;
  show: boolean;
  repositoryValue: string | null;
  description?: string;
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
  const pluginsDir = talendStudioPath
    ? join(talendStudioPath, "plugins")
    : undefined;

  const scanResult = await scanInstalledPlugins({ pluginsDir });

  const catalog = scanResult.entries.map(jarToCatalogEntry);

  const talendStudioHome = talendStudioPath ?? process.env.TALEND_STUDIO_PATH ?? "/Applications/TalendStudio-8.0.1/studio";
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

export async function getCatalogStatus(): Promise<CatalogStatus> {
  const catalogPath = join(process.cwd(), CATALOG_DIR, CATALOG_FILE);

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
  const catalogPath = join(process.cwd(), CATALOG_DIR, CATALOG_FILE);

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
  const catalogPath = join(process.cwd(), CATALOG_DIR, CATALOG_FILE);

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

export async function getComponentParameters(componentName: string): Promise<ComponentParameter[]> {
  const entry = await inspectComponent(componentName);
  return entry?.parameters ?? [];
}

export async function getComponentConnectors(componentName: string): Promise<string[]> {
  const entry = await inspectComponent(componentName);
  return entry?.connectors ?? [];
}

export async function generateComponentTemplate(componentName: string): Promise<{ ok: boolean; template?: string; error?: string }> {
  const entry = await inspectComponent(componentName);
  if (!entry) {
    return { ok: false, error: "Component not found: " + componentName };
  }

  const requiredParams = entry.parameters.filter((p) => p.required);
  const template = {
    componentName: entry.componentName ?? componentName,
    family: entry.family,
    requiredParameters: requiredParams.map((p) => ({
      name: p.name,
      defaultValue: p.defaultValue,
      description: p.description ?? "",
    })),
    optionalParameters: entry.parameters
      .filter((p) => !p.required)
      .map((p) => ({
        name: p.name,
        defaultValue: p.defaultValue,
      })),
    schemas: entry.schemas,
    connectors: entry.connectors,
  };

  return { ok: true, template: JSON.stringify(template, null, 2) };
}

export async function validateComponentUsage(
  componentName: string,
  parameters: Record<string, string>,
): Promise<{ ok: boolean; valid: boolean; errors: string[]; warnings: string[] }> {
  const entry = await inspectComponent(componentName);
  if (!entry) {
    return { ok: false, valid: false, errors: ["Component not found: " + componentName], warnings: [] };
  }

  const errors: string[] = [];
  const warnings: string[] = [];
  const requiredParams = entry.parameters.filter((p) => p.required);

  for (const req of requiredParams) {
    const value = parameters[req.name];
    if (!value || value.trim() === "") {
      errors.push("Parámetro requerido faltante: " + req.name);
    }
  }

  const unknownParams = Object.keys(parameters).filter((k) => !entry.parameters.find((p) => p.name === k));
  if (unknownParams.length > 0) {
    warnings.push("Parámetros desconocidos: " + unknownParams.join(", "));
  }

  return { ok: true, valid: errors.length === 0, errors, warnings };
}
