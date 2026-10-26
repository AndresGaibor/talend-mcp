import * as fs from "fs";
import type { TalendComponentDefinition } from "../../domain/component-definition";
import { buildComponentDefinition } from "./component-builder";
import { collectByKey } from "./metadata-extractor";
import { talendXmlParser } from "./xml-parser";

/** Lee un descriptor.xml y devuelve sus componentes. */
export async function parseDescriptor(
  xmlPath: string,
  pluginId: string,
  pluginPath: string
): Promise<TalendComponentDefinition[]> {
  const xml = fs.readFileSync(xmlPath, "utf-8");
  const parsed = talendXmlParser.parse(xml) as Record<string, unknown>;
  return extractComponentsFromDescriptor(parsed, pluginId, pluginPath, xmlPath);
}

/** Extrae los componentes declarados en un descriptor ya parseado. */
export function extractComponentsFromDescriptor(
  parsed: Record<string, unknown>,
  pluginId: string,
  pluginPath: string,
  descriptorPath: string
): TalendComponentDefinition[] {
  const components: TalendComponentDefinition[] = [];
  const scannedAt = new Date().toISOString();

  const catalog = parsed.CATALOG ?? parsed.catalog ?? {};
  const componentEntries = collectByKey(parsed, ["COMPONENT", "component", "COMPONENTS", "components"]);

  for (const entry of componentEntries) {
    if (!entry || typeof entry !== "object") continue;
    const comp = entry as Record<string, unknown>;
    const header = (comp.HEADER ?? comp.header ?? {}) as Record<string, unknown>;
    const impl = (comp.IMPL ?? comp.impl ?? {}) as Record<string, unknown>;

    const name = String(header.NAME ?? header.name ?? "");
    if (!name) continue;

    const family = String(header.FAMILY ?? header.family ?? "Unknown");
    const version = String(header.VERSION ?? header.version ?? "1.0");

    components.push(
      buildComponentDefinition({
        comp,
        name,
        family,
        version,
        pluginId,
        pluginPath,
        descriptorPath,
        scannedAt,
      })
    );
  }

  return components;
}
