import * as fs from "fs";
import * as path from "path";
import type { TalendComponentDefinition } from "../../domain/component-definition";
import { buildComponentDefinition } from "./component-builder";
import { talendXmlParser } from "./xml-parser";

/** Recorre la carpeta components de un plugin y devuelve sus componentes. */
export async function scanComponentsDir(
  componentsDir: string,
  pluginId: string,
  pluginPath: string
): Promise<TalendComponentDefinition[]> {
  const components: TalendComponentDefinition[] = [];
  const scannedAt = new Date().toISOString();

  let entries: string[];
  try {
    entries = fs.readdirSync(componentsDir);
  } catch {
    return [];
  }

  for (const entry of entries) {
    const entryPath = path.join(componentsDir, entry);
    let stat: fs.Stats;
    try {
      stat = fs.statSync(entryPath);
    } catch {
      continue;
    }

    if (stat.isDirectory()) {
      const xmlFiles = findComponentXmlFiles(entryPath);
      for (const xmlFile of xmlFiles) {
        try {
          const component = await parseComponentXmlFile(xmlFile, pluginId, pluginPath, scannedAt);
          if (component) {
            components.push(component);
          }
        } catch (e) {
          console.warn(`Error parsing component XML ${xmlFile}: ${e}`);
        }
      }
    } else if (entry.endsWith(".xml")) {
      try {
        const component = await parseComponentXmlFile(entryPath, pluginId, pluginPath, scannedAt);
        if (component) {
          components.push(component);
        }
      } catch (e) {
        console.warn(`Error parsing component XML ${entryPath}: ${e}`);
      }
    }
  }

  return components;
}

/** Lista los XML de componente de una carpeta. */
function findComponentXmlFiles(dirPath: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dirPath)) return results;

  const entries = fs.readdirSync(dirPath);
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry);
    if (entry.endsWith("_java.xml") || entry.endsWith(".xml")) {
      results.push(fullPath);
    }
  }
  return results;
}

/** Lee un XML de componente; el nombre cae al del archivo si no viene en HEADER. */
async function parseComponentXmlFile(
  xmlPath: string,
  pluginId: string,
  pluginPath: string,
  scannedAt: string
): Promise<TalendComponentDefinition | null> {
  const xml = fs.readFileSync(xmlPath, "utf-8");
  const parsed = talendXmlParser.parse(xml) as Record<string, unknown>;

  const rawComponent = parsed.COMPONENT ?? parsed.component ?? {};
  const comp = rawComponent as Record<string, unknown>;
  const header = (comp.HEADER ?? comp.header ?? {}) as Record<string, unknown>;
  const impl = (comp.IMPL ?? comp.impl ?? {}) as Record<string, unknown>;

  const name = String(header.NAME ?? header.name ?? path.basename(xmlPath, ".xml"));
  if (!name) return null;

  const family = String(header.FAMILY ?? header.family ?? "Unknown");
  const version = String(header.VERSION ?? header.version ?? "1.0");

  return buildComponentDefinition({
    comp,
    name,
    family,
    version,
    pluginId,
    pluginPath,
    descriptorPath: xmlPath,
    scannedAt,
  });
}
