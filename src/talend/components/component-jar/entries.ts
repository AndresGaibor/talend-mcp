import type { ComponentJarEntry } from "./types";

export function dedupeEntries(entries: ComponentJarEntry[]): ComponentJarEntry[] {
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

export function entriesToCatalogFormat(entries: ComponentJarEntry[], scannedPlugins: string[], errors: string[], talendStudioHome: string): {
  generatedAt: number; talendStudioHome: string; entries: ComponentJarEntry[]; errors: string[]; scannedPlugins: string[];
} {
  return { generatedAt: Date.now(), talendStudioHome, entries, errors, scannedPlugins };
}
