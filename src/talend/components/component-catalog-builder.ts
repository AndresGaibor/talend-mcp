import { existsSync, readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join, basename } from "node:path";
import { inflateSync } from "node:zlib";

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

type ComponentXml = {
  NAME?: string;
  VERSION?: string;
  FAMILY?: string;
  PARAMETERS?: Array<{ NAME?: string; VALUE?: string; REQUIRED?: string; SHOW?: string; FIELD?: string; REPOSITORY_VALUE?: string }>;
};

export async function buildComponentCatalog(talendStudioPath?: string): Promise<CatalogStatus> {
  const errors: string[] = [];
  const scannedPlugins: string[] = [];
  const entries: ComponentCatalogEntry[] = [];

  if (!talendStudioPath) {
    talendStudioPath = process.env.TALEND_STUDIO_PATH ?? "/Applications/TalendStudio-8.0.1/studio";
  }

  const pluginsDir = join(talendStudioPath, "plugins");
  if (!existsSync(pluginsDir)) {
    return {
      ok: false,
      catalogPath: null,
      entryCount: 0,
      lastUpdated: null,
      scannedPlugins: [],
      errors: [`Plugins directory not found: ${pluginsDir}`],
    };
  }

  try {
    const pluginDirs = readdirSync(pluginsDir).filter((d) => d.startsWith("org.talend.designer.") || d.startsWith("org.talend.l"));
    for (const pluginDir of pluginDirs) {
      scannedPlugins.push(pluginDir);
    }
  } catch (e) {
    errors.push(`Cannot read plugins directory: ${e}`);
  }

  const catalogPath = join(process.cwd(), ".talend-mcp", "component-catalog.json");
  const lastUpdated = Date.now();

  return {
    ok: errors.length === 0,
    catalogPath,
    entryCount: entries.length,
    lastUpdated,
    scannedPlugins,
    errors,
  };
}

export async function getCatalogStatus(): Promise<CatalogStatus> {
  const catalogPath = join(process.cwd(), ".talend-mcp", "component-catalog.json");

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
      lastUpdated: data.lastUpdated ?? null,
      scannedPlugins: data.scannedPlugins ?? [],
      errors: [],
    };
  } catch (e) {
    return {
      ok: false,
      catalogPath: null,
      entryCount: 0,
      lastUpdated: null,
      scannedPlugins: [],
      errors: [`Failed to read catalog: ${e}`],
    };
  }
}

export async function searchComponents(query: string, maxResults = 20): Promise<ComponentCatalogEntry[]> {
  const catalogPath = join(process.cwd(), ".talend-mcp", "component-catalog.json");

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
          e.connectors.some((c) => c.toLowerCase().includes(lowerQuery))
      )
      .slice(0, maxResults);
  } catch {
    return [];
  }
}

export async function inspectComponent(componentName: string): Promise<ComponentCatalogEntry | null> {
  const catalogPath = join(process.cwd(), ".talend-mcp", "component-catalog.json");

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
    return { ok: false, error: `Component not found: ${componentName}` };
  }

  const requiredParams = entry.parameters.filter((p) => p.required);
  const template = {
    componentName: entry.componentName,
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
  parameters: Record<string, string>
): Promise<{ ok: boolean; valid: boolean; errors: string[]; warnings: string[] }> {
  const entry = await inspectComponent(componentName);
  if (!entry) {
    return { ok: false, valid: false, errors: [`Component not found: ${componentName}`], warnings: [] };
  }

  const errors: string[] = [];
  const warnings: string[] = [];
  const requiredParams = entry.parameters.filter((p) => p.required);

  for (const req of requiredParams) {
    const value = parameters[req.name];
    if (!value || value.trim() === "") {
      errors.push(`Parámetro requerido faltante: ${req.name}`);
    }
  }

  const unknownParams = Object.keys(parameters).filter((k) => !entry.parameters.find((p) => p.name === k));
  if (unknownParams.length > 0) {
    warnings.push(`Parámetros desconocidos: ${unknownParams.join(", ")}`);
  }

  return {
    ok: true,
    valid: errors.length === 0,
    errors,
    warnings,
  };
}