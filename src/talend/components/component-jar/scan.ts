import { readdirSync } from "node:fs";
import { join } from "node:path";
import { resolveTalendPluginsDir } from "../talend-paths";
import { findAllLocalComponentsDirs, listComponentDirs, scanComponentDir } from "./dir-scan";
import { dedupeEntries } from "./entries";
import { scanJarFile } from "./jar-scan";
import type { ComponentJarEntry, ScanPluginsResult } from "./types";

function getTalendStudioPluginsDir(): string | null {
  return resolveTalendPluginsDir();
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
