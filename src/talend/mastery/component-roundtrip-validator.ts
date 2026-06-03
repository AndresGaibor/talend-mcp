import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseJobItem } from "../job-parser";
import { buildJobItemXml } from "../job-generator";

export type RoundtripValidationResult = {
  ok: boolean;
  componentName: string;
  itemPath: string;
  roundtripValid: boolean;
  error?: string;
  details?: {
    parsedComponents: number;
    rebuiltComponents: number;
    componentsMatch: boolean;
    connectionsPreserved: boolean;
  };
};

export async function validateComponentRoundtrip(
  componentName: string,
  itemPath: string,
): Promise<RoundtripValidationResult> {
  if (!existsSync(itemPath)) {
    return {
      ok: false,
      componentName,
      itemPath,
      roundtripValid: false,
      error: "Item file not found: " + itemPath,
    };
  }

  try {
    const originalXml = readFileSync(itemPath, "utf8");
    const parsed = parseJobItem(originalXml, itemPath);

    const parsedComponents = parsed.components.filter((c) =>
      c.componentName === componentName || c.uniqueName.startsWith(componentName + "_"));

    if (parsedComponents.length === 0) {
      return {
        ok: true,
        componentName,
        itemPath,
        roundtripValid: false,
        error: "Componente '" + componentName + "' no encontrado en el archivo",
      };
    }

    const spec = {
      jobName: "RoundtripTest",
      version: "0.1",
      components: parsed.components.map((c) => ({
        componentName: c.componentName,
        uniqueName: c.uniqueName,
        label: c.label,
        parameters: c.parameters,
        posX: parseInt(c.nodeAttributes?.xmlNodeX ?? "160", 10) || 160,
        posY: parseInt(c.nodeAttributes?.xmlNodeY ?? "96", 10) || 96,
      })),
      connections: parsed.connections.map((c) => ({
        source: c.source,
        target: c.target,
        label: c.label ?? "",
        connectorName: c.connectorName ?? "FLOW",
        uniqueName: c.uniqueName,
      })),
    };

    const { xml: rebuiltXml } = buildJobItemXml(spec);
    const reparsed = parseJobItem(rebuiltXml, itemPath + ".rebuilt");

    const componentsMatch = parsed.components.length === reparsed.components.length;
    const connectionsPreserved = parsed.connections.length === reparsed.connections.length;

    const roundtripValid = componentsMatch && connectionsPreserved;

    return {
      ok: true,
      componentName,
      itemPath,
      roundtripValid,
      details: {
        parsedComponents: parsed.components.length,
        rebuiltComponents: reparsed.components.length,
        componentsMatch,
        connectionsPreserved,
      },
    };
  } catch (e) {
    return {
      ok: false,
      componentName,
      itemPath,
      roundtripValid: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
