import { existsSync, readdirSync, readFileSync, statSync, mkdirSync } from "node:fs";
import { join, basename } from "node:path";
import { resolveTalendPluginsDir } from "./talend-paths";
import { parseComponentXmlWithParser } from "./component-xml-parser";

export type ComponentJarEntry = {
  componentName: string;
  family: string;
  version: string;
  sourcePlugin: string;
  definitionFiles: string[];
  parameters: JarParameter[];
  connectors: JarConnector[];
  schemas: JarSchemas;
  capabilities: JarCapabilities;
  limitations: string[];
};

export type JarParameter = {
  name: string;
  field: string;
  required: boolean;
  defaultValue: string | null;
  show: boolean;
  repositoryValue: string | null;
  raw?: Record<string, unknown>;
};

export type JarConnector = {
  name: string;
  type: "FLOW" | "ITERATE" | "REJECT" | "LOOKUP" | "UNKNOWN";
  maxInput?: number;
  maxOutput?: number;
};

export type JarSchemas = {
  hasInputSchema: boolean;
  hasOutputSchema: boolean;
  hasDynamicSchema: boolean;
};

export type JarCapabilities = {
  canStartFlow: boolean;
  canReceiveFlow: boolean;
  canOutputFlow: boolean;
  canUseReject: boolean;
  canUseIterate: boolean;
};

export type ScanPluginsResult = {
  scannedPlugins: string[];
  entries: ComponentJarEntry[];
  errors: string[];
};

function getTalendStudioPluginsDir(): string | null {
  return resolveTalendPluginsDir();
}

function findAllLocalComponentsDirs(pluginsDir: string): { dir: string; pluginName: string }[] {
  const results: { dir: string; pluginName: string }[] = [];
  try {
    const dirs = readdirSync(pluginsDir);
    for (const d of dirs) {
      const fullPath = join(pluginsDir, d);
      try {
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
          const compDir = join(fullPath, "components");
          if (existsSync(compDir)) {
            results.push({ dir: compDir, pluginName: d });
          }
          const tacoDir = join(fullPath, "tacokit", "components");
          if (existsSync(tacoDir)) {
            results.push({ dir: tacoDir, pluginName: d });
          }
        }
      } catch {}
    }
  } catch {}
  return results;
}

function listComponentDirs(cd: string): string[] {
  try {
    return readdirSync(cd).filter((d) => {
      try { return statSync(join(cd, d)).isDirectory() && !d.startsWith("."); }
      catch { return false; }
    });
  } catch { return []; }
}

async function listJarEntries(jarPath: string): Promise<string[]> {
  const proc = Bun.spawn(["jar", "tf", jarPath], {
    stdout: "pipe",
    stderr: "pipe",
  });

  const out = await new Response(proc.stdout).text();
  await proc.exited;

  return out
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

function looksLikeComponentXml(entry: string): boolean {
  return (
    entry.includes("components/") &&
    (
      entry.endsWith("_java.xml") ||
      entry.endsWith("component.xml") ||
      entry.endsWith(".xml")
    )
  );
}

async function extractJarEntry(
  jarPath: string,
  entry: string,
  targetDir: string
): Promise<string | null> {
  mkdirSync(targetDir, { recursive: true });

  const proc = Bun.spawn(["jar", "xf", jarPath, entry], {
    cwd: targetDir,
    stdout: "pipe",
    stderr: "pipe",
  });

  await proc.exited;

  const extracted = join(targetDir, entry);
  return existsSync(extracted) ? extracted : null;
}

async function scanJarFile(jarPath: string, errors: string[]): Promise<ComponentJarEntry[]> {
  const entries: ComponentJarEntry[] = [];
  let jarEntries: string[];
  try {
    jarEntries = await listJarEntries(jarPath);
  } catch (e) {
    errors.push(`Error listing entries in ${jarPath}: ${e}`);
    return [];
  }

  const xmlEntries = jarEntries.filter(looksLikeComponentXml);

  const tmpDir = join(
    process.cwd(),
    ".talend-mcp",
    "tmp",
    "component-scan",
    basename(jarPath).replace(/[^a-zA-Z0-9_.-]/g, "_")
  );

  for (const xmlEntry of xmlEntries) {
    try {
      const extracted = await extractJarEntry(jarPath, xmlEntry, tmpDir);
      if (!extracted) continue;

      const xml = readFileSync(extracted, "utf8");
      const parsed = parseComponentXmlWithParser(xml);

      const parts = xmlEntry.split("/");
      const fallbackName = parts.length >= 2 ? parts[parts.length - 2] : basename(xmlEntry, "_java.xml");
      const componentName = parsed.name || fallbackName;

      if (!componentName) continue;

      entries.push({
        componentName,
        family: parsed.family,
        version: parsed.version,
        sourcePlugin: basename(jarPath),
        definitionFiles: [xmlEntry],
        parameters: parsed.parameters,
        connectors: parsed.connectors,
        schemas: parsed.schemas,
        capabilities: parsed.capabilities,
        limitations: parsed.limitations,
      });
    } catch (e) {
      errors.push(
        `Error parsing ${jarPath}:${xmlEntry}: ${
          e instanceof Error ? e.message : String(e)
        }`
      );
    }
  }

  return entries;
}

function scanComponentDir(dirName: string, cd: string, src: string, errors: string[]): ComponentJarEntry | null {
  for (const xn of [dirName + "_java.xml", dirName + ".xml", "component.xml"]) {
    const xp = join(cd, dirName, xn);
    if (existsSync(xp)) {
      try {
        const xml = readFileSync(xp, "utf8");
        const parsed = parseComponentXmlWithParser(xml);
        
        const componentName = parsed.name || dirName;
        if (!componentName) continue;

        return {
          componentName,
          family: parsed.family,
          version: parsed.version,
          sourcePlugin: src,
          definitionFiles: [xp],
          parameters: parsed.parameters,
          connectors: parsed.connectors,
          schemas: parsed.schemas,
          capabilities: parsed.capabilities,
          limitations: parsed.limitations,
        };
      } catch (e) {
        errors.push(`Error parsing ${xp}: ${e}`);
        return null;
      }
    }
  }
  return null;
}

function dedupeEntries(entries: ComponentJarEntry[]): ComponentJarEntry[] {
  const map = new Map<string, ComponentJarEntry>();

  for (const entry of entries) {
    const key = `${entry.componentName}@${entry.version}`;

    const existing = map.get(key);
    if (!existing) {
      map.set(key, entry);
      continue;
    }

    map.set(key, {
      ...existing,
      definitionFiles: [...new Set([...existing.definitionFiles, ...entry.definitionFiles])],
      limitations: [...new Set([...existing.limitations, ...entry.limitations])],
    });
  }

  return [...map.values()];
}

export async function scanInstalledPlugins(options?: { pluginsDir?: string }): Promise<ScanPluginsResult> {
  const errors: string[] = [];
  const scannedPlugins: string[] = [];
  const entries: ComponentJarEntry[] = [];
  
  const pluginsDir = options?.pluginsDir ?? getTalendStudioPluginsDir();
  if (!pluginsDir) {
    return { scannedPlugins: [], entries: [], errors: ["Cannot find Talend plugins dir"] };
  }

  try {
    const dirs = readdirSync(pluginsDir);
    for (const d of dirs) {
      if (d.startsWith("org.talend.designer.") || d.startsWith("org.talend.l")) {
        scannedPlugins.push(d);
      }
    }
  } catch (e) {
    errors.push("Cannot read plugins directory: " + e);
    return { scannedPlugins: [], entries: [], errors };
  }

  // 1. Unzipped plugin components
  const compDirs = findAllLocalComponentsDirs(pluginsDir);
  if (compDirs.length > 0) {
    for (const { dir, pluginName } of compDirs) {
      for (const dn of listComponentDirs(dir)) {
        const e = scanComponentDir(dn, dir, pluginName, errors);
        if (e) entries.push(e);
      }
    }
  } else {
    errors.push("No components directories found in plugins");
  }

  // 2. Scan JAR files
  for (const plugin of scannedPlugins) {
    if (plugin.endsWith(".jar")) {
      const jarPath = join(pluginsDir, plugin);
      const jarEntries = await scanJarFile(jarPath, errors);
      entries.push(...jarEntries);
    }
  }

  return {
    scannedPlugins,
    entries: dedupeEntries(entries),
    errors
  };
}

export function entriesToCatalogFormat(entries: ComponentJarEntry[], scannedPlugins: string[], errors: string[], talendStudioHome: string): {
  generatedAt: number; talendStudioHome: string; entries: ComponentJarEntry[]; errors: string[]; scannedPlugins: string[];
} {
  return { generatedAt: Date.now(), talendStudioHome, entries, errors, scannedPlugins };
}