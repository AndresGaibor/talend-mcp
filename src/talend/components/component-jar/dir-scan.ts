import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { parseComponentXmlWithParser } from "../component-xml-parser";
import type { ComponentJarEntry } from "./types";

export function findAllLocalComponentsDirs(pluginsDir: string): { dir: string; pluginName: string }[] {
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

export function listComponentDirs(cd: string): string[] {
  try {
    return readdirSync(cd).filter((d) => {
      try { return statSync(join(cd, d)).isDirectory() && !d.startsWith("."); }
      catch { return false; }
    });
  } catch { return []; }
}

export function scanComponentDir(dirName: string, cd: string, src: string, errors: string[]): ComponentJarEntry | null {
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
