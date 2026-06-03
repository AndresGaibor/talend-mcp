import { existsSync, readFileSync } from "node:fs";
import { join, basename } from "node:path";
import { parseComponentXmlWithParser } from "./component-xml-parser";

export type ComponentDefinitionParseResult = {
  ok: boolean;
  componentName: string;
  family: string;
  version: string;
  parameters: Array<{
    name: string;
    field: string;
    required: boolean;
    defaultValue: string | null;
    show: boolean;
    repositoryValue: string | null;
  }>;
  connectors: Array<{
    name: string;
    type: string;
    maxInput?: number;
    maxOutput?: number;
  }>;
  schemas: {
    hasInputSchema: boolean;
    hasOutputSchema: boolean;
    hasDynamicSchema: boolean;
  };
  sourceFile: string;
  error?: string;
};

export function parseComponentDefinitionXml(xmlContent: string, sourceFile: string): ComponentDefinitionParseResult {
  try {
    const parsed = parseComponentXmlWithParser(xmlContent);
    return {
      ok: true,
      componentName: parsed.name || basename(sourceFile, ".xml"),
      family: parsed.family,
      version: parsed.version,
      parameters: parsed.parameters,
      connectors: parsed.connectors,
      schemas: parsed.schemas,
      sourceFile,
    };
  } catch (e) {
    return {
      ok: false,
      componentName: "",
      family: "",
      version: "",
      parameters: [],
      connectors: [],
      schemas: { hasInputSchema: false, hasOutputSchema: false, hasDynamicSchema: false },
      sourceFile,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export function loadAndParseComponentDefinition(xmlPath: string): ComponentDefinitionParseResult {
  if (!existsSync(xmlPath)) {
    return {
      ok: false,
      componentName: "",
      family: "",
      version: "",
      parameters: [],
      connectors: [],
      schemas: { hasInputSchema: false, hasOutputSchema: false, hasDynamicSchema: false },
      sourceFile: xmlPath,
      error: "File not found: " + xmlPath,
    };
  }

  try {
    const content = readFileSync(xmlPath, "utf8");
    return parseComponentDefinitionXml(content, xmlPath);
  } catch (e) {
    return {
      ok: false,
      componentName: "",
      family: "",
      version: "",
      parameters: [],
      connectors: [],
      schemas: { hasInputSchema: false, hasOutputSchema: false, hasDynamicSchema: false },
      sourceFile: xmlPath,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
