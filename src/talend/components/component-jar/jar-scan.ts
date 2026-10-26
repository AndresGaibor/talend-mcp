import { readFileSync } from "node:fs";
import { join, basename } from "node:path";
import { parseComponentXmlWithParser } from "../component-xml-parser";
import { extractJarEntry, listJarEntries } from "./jar-command";
import type { ComponentJarEntry } from "./types";

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

export async function scanJarFile(jarPath: string, errors: string[]): Promise<ComponentJarEntry[]> {
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
