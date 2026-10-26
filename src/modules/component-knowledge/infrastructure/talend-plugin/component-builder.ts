import type { TalendComponentDefinition } from "../../domain/component-definition";
import { extractConnectors, extractParameters, extractSchemas } from "./metadata-extractor";

/** Datos ya resueltos de un componente antes de normalizar la definición. */
export type ComponentDefinitionInput = {
  comp: Record<string, unknown>;
  name: string;
  family: string;
  version: string;
  pluginId: string;
  pluginPath: string;
  descriptorPath: string;
  scannedAt: string;
};

/** Normaliza un componente a la definición que consume el catálogo. */
export function buildComponentDefinition(input: ComponentDefinitionInput): TalendComponentDefinition {
  const parameters = extractParameters(input.comp);
  const connectors = extractConnectors(input.comp);
  const schemas = extractSchemas(input.comp, connectors);

  return {
    id: `${input.pluginId}:${input.name}`,
    name: input.name,
    family: input.family,
    paletteCategory: input.family,
    version: input.version,
    source: {
      pluginId: input.pluginId,
      pluginPath: input.pluginPath,
      descriptorPath: input.descriptorPath,
      scannedAt: input.scannedAt,
    },
    connectors,
    parameters,
    schemas,
    examples: [],
    commonUseCases: [],
    relatedComponents: [],
    warnings: [],
    confidence: "high",
  };
}
